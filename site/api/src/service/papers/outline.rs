//! Question outlines extracted from configured Google Docs papers

use super::config;
use crate::routing::response::{json_error, json_response, method_error, unavailable_error};
use crate::shared::cache::{edge, policy::PAPERS, short_hash};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use worker::{Context, Fetch, Method, Request, Response, Result, Url};

const MAX_SOURCE_BYTES: usize = 2_000_000;
const MAX_ITEMS: usize = 64;
const MAX_TABS: usize = 16;

#[derive(Debug, Deserialize, Serialize)]
struct Outline {
    tabs: Vec<Tab>,
    items: Vec<Heading>,
}

#[derive(Debug, Deserialize, Serialize)]
struct Tab {
    label: String,
    id: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct Heading {
    label: String,
    anchor: String,
    level: u8,
}

pub(super) async fn respond(
    request: &Request,
    code: &str,
    id: &str,
    context: &Context,
) -> Result<Response> {
    if request.method() != Method::Get {
        return method_error("Use GET for paper outlines", "GET, OPTIONS", None);
    }
    let source = match config::outline_source(code, id) {
        Ok(Some(source)) => source,
        Ok(None) => return json_error("not_found", "Paper outline not found", 404, None),
        Err(()) => {
            return unavailable_error("outline_unavailable", "Paper outline is unavailable", None);
        }
    };
    let key = format!(
        "https://paper-outline-cache.invalid/v2/{}",
        short_hash(source.as_bytes())
    );
    match edge::response(&key).await {
        Ok(Some(response)) => return Ok(response),
        Ok(None) => {}
        Err(error) => worker::console_error!("Paper outline cache read failed: {error}"),
    }
    let preview_url = document_url(&source, "preview", Some("t.0"))?;
    let tabs = match fetch_source(preview_url).await? {
        Some(body) => parse_tabs(&body),
        None => Vec::new(),
    };
    let answer_tab = tabs
        .iter()
        .find(|tab| tab.label.eq_ignore_ascii_case("answers"));
    let url = match answer_tab {
        Some(tab) => document_url(&source, "mobilebasic", Some(&tab.id))?,
        None => Url::parse(&source)
            .map_err(|_| worker::Error::RustError("Invalid paper source".into()))?,
    };
    let Some(body) = fetch_source(url).await? else {
        return unavailable_error("outline_unavailable", "Paper outline is unavailable", None);
    };
    let outline = Outline {
        tabs,
        items: parse(&body),
    };
    let mut response = json_response(&outline, 200, None, PAPERS)?;
    edge::put(context, key, response.cloned()?);
    Ok(response)
}

async fn fetch_source(url: Url) -> Result<Option<String>> {
    let mut upstream = match Fetch::Url(url).send().await {
        Ok(response) if response.status_code() == 200 => response,
        _ => return Ok(None),
    };
    if upstream
        .headers()
        .get("Content-Length")?
        .and_then(|value| value.parse::<usize>().ok())
        .is_some_and(|length| length > MAX_SOURCE_BYTES)
    {
        return Ok(None);
    }
    let body = upstream.text().await?;
    if body.len() > MAX_SOURCE_BYTES {
        return Ok(None);
    }
    Ok(Some(body))
}

fn document_url(source: &str, view: &str, tab: Option<&str>) -> Result<Url> {
    let mut url =
        Url::parse(source).map_err(|_| worker::Error::RustError("Invalid paper source".into()))?;
    let path = url
        .path()
        .strip_suffix("/mobilebasic")
        .ok_or_else(|| worker::Error::RustError("Invalid paper source".into()))?;
    url.set_path(&format!("{path}/{view}"));
    if let Some(tab) = tab {
        url.query_pairs_mut().append_pair("tab", tab);
    }
    Ok(url)
}

fn parse_tabs(source: &str) -> Vec<Tab> {
    let mut tabs = Vec::new();
    let root_marker = r#""ty":"mkch","d":[[1,""#;
    if let Some(start) = source
        .find(root_marker)
        .map(|index| index + root_marker.len())
        && let Some(end) = source[start..].find('"').map(|index| start + index)
    {
        tabs.push(Tab {
            label: source[start..end].chars().take(160).collect(),
            id: "t.0".into(),
        });
    }
    let child_marker = r#""ty":"ac","d":[""#;
    let mut cursor = 0;
    while tabs.len() < MAX_TABS
        && let Some(start) = source[cursor..]
            .find(child_marker)
            .map(|index| cursor + index + child_marker.len())
    {
        let Some(id_end) = source[start..].find('"').map(|index| start + index) else {
            break;
        };
        let label_marker = r#",[1,""#;
        let Some(label_start) = source[id_end..]
            .find(label_marker)
            .map(|index| id_end + index + label_marker.len())
        else {
            cursor = id_end + 1;
            continue;
        };
        let Some(label_end) = source[label_start..]
            .find('"')
            .map(|index| label_start + index)
        else {
            break;
        };
        let id = &source[start..id_end];
        if valid_tab(id) {
            tabs.push(Tab {
                label: source[label_start..label_end].chars().take(160).collect(),
                id: id.into(),
            });
        }
        cursor = label_end + 1;
    }
    tabs
}

fn valid_tab(value: &str) -> bool {
    value.starts_with("t.")
        && value.len() <= 80
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_'))
}

fn parse(source: &str) -> Vec<Heading> {
    let mut cursor = 0;
    let mut question_level = None;
    let mut seen = HashSet::new();
    let mut items = Vec::new();
    while items.len() < MAX_ITEMS {
        let Some(offset) = source[cursor..].find("<h") else {
            break;
        };
        let start = cursor + offset;
        let Some(level) = source
            .as_bytes()
            .get(start + 2)
            .and_then(|byte| (matches!(byte, b'1'..=b'3')).then_some(byte - b'0'))
        else {
            cursor = start + 2;
            continue;
        };
        let Some(open_end_offset) = source[start..].find('>') else {
            break;
        };
        let open_end = start + open_end_offset;
        let open = &source[start..=open_end];
        let close = format!("</h{level}>");
        let content_start = open_end + 1;
        let Some(content_end_offset) = source[content_start..].find(&close) else {
            cursor = content_start;
            continue;
        };
        let content_end = content_start + content_end_offset;
        cursor = content_end + close.len();
        let Some(anchor) = attribute(open, "id") else {
            continue;
        };
        if !valid_anchor(anchor) || !seen.insert(anchor) {
            continue;
        }
        let label = plain_text(&source[content_start..content_end]);
        let is_question = question_label(&label);
        let belongs_to_question = question_level.is_some_and(|parent| level > parent);
        if is_question || belongs_to_question {
            if is_question && !belongs_to_question {
                question_level = Some(level);
            }
            items.push(Heading {
                label: label.chars().take(160).collect(),
                anchor: anchor.into(),
                level,
            });
        } else {
            question_level = None;
        }
    }
    items
}

fn attribute<'a>(tag: &'a str, name: &str) -> Option<&'a str> {
    let marker = format!("{name}=\"");
    let start = tag.find(&marker)? + marker.len();
    let end = tag[start..].find('"')? + start;
    Some(&tag[start..end])
}

fn valid_anchor(value: &str) -> bool {
    value.starts_with("h.")
        && value.len() <= 80
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_'))
}

fn plain_text(source: &str) -> String {
    let mut text = String::with_capacity(source.len());
    let mut in_tag = false;
    for character in source.chars() {
        match character {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => text.push(character),
            _ => {}
        }
    }
    let decoded = text
        .replace("&nbsp;", " ")
        .replace("&#39;", "'")
        .replace("&quot;", "\"")
        .replace("&gt;", ">")
        .replace("&lt;", "<")
        .replace("&amp;", "&");
    decoded.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn question_label(label: &str) -> bool {
    let lower = label.to_ascii_lowercase();
    let rest = lower
        .strip_prefix("question")
        .or_else(|| lower.strip_prefix('q'))
        .unwrap_or("")
        .trim_start();
    rest.as_bytes().first().is_some_and(u8::is_ascii_digit)
}

#[cfg(test)]
mod tests {
    use super::{document_url, parse, parse_tabs};

    #[test]
    fn extracts_only_real_question_headings_in_source_order() {
        let source = r#"
            <h1 id="h.intro"><span>Questions and corrections</span></h1>
            <h2 id="h.intro-help">Adding answers</h2>
            <h1 id="h.q1"><span>Question 1. (3 Marks)</span></h1>
            <h2 id="h.q1a">1.1) [2 marks]</h2>
            <h3 id="h.q1ai">(a) First part</h3>
            <h1 id="unsafe-anchor!">Question 2</h1>
            <h1 id="h.q3">Q3</h1>
        "#;
        let value = serde_json::to_value(parse(source)).unwrap();
        assert_eq!(value.as_array().unwrap().len(), 4);
        assert_eq!(value[0]["label"], "Question 1. (3 Marks)");
        assert_eq!(value[1]["label"], "1.1) [2 marks]");
        assert_eq!(value[1]["level"], 2);
        assert_eq!(value[2]["label"], "(a) First part");
        assert_eq!(value[3]["anchor"], "h.q3");
    }

    #[test]
    fn extracts_real_document_tabs() {
        let source = r#"
            {"ty":"mkch","d":[[1,"Guidelines"]]}
            {"ty":"ac","d":["t.answers_1",[1,"Answers"],[1]]}
        "#;
        let value = serde_json::to_value(parse_tabs(source)).unwrap();
        assert_eq!(value[0]["label"], "Guidelines");
        assert_eq!(value[0]["id"], "t.0");
        assert_eq!(value[1]["label"], "Answers");
        assert_eq!(value[1]["id"], "t.answers_1");
    }

    #[test]
    fn document_tab_url_preserves_the_resource_key() {
        let url = document_url(
            "https://docs.google.com/document/d/example/mobilebasic?resourcekey=key",
            "mobilebasic",
            Some("t.answers"),
        )
        .unwrap();
        assert_eq!(
            url.as_str(),
            "https://docs.google.com/document/d/example/mobilebasic?resourcekey=key&tab=t.answers"
        );
    }
}
