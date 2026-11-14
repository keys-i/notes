//! Question outlines extracted from configured Google Docs papers

use super::config;
use crate::routing::response::{json_error, json_response, method_error, unavailable_error};
use crate::shared::cache::{edge, policy::PAPERS, short_hash};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use worker::{Context, Fetch, Method, Request, Response, Result, Url};

const MAX_SOURCE_BYTES: usize = 2_000_000;
const MAX_ITEMS: usize = 64;

#[derive(Debug, Deserialize, Serialize)]
struct Outline {
    items: Vec<Heading>,
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
        "https://paper-outline-cache.invalid/{}",
        short_hash(source.as_bytes())
    );
    match edge::response(&key).await {
        Ok(Some(response)) => return Ok(response),
        Ok(None) => {}
        Err(error) => worker::console_error!("Paper outline cache read failed: {error}"),
    }
    let url =
        Url::parse(&source).map_err(|_| worker::Error::RustError("Invalid paper source".into()))?;
    let mut upstream = match Fetch::Url(url).send().await {
        Ok(response) if response.status_code() == 200 => response,
        _ => {
            return unavailable_error("outline_unavailable", "Paper outline is unavailable", None);
        }
    };
    if upstream
        .headers()
        .get("Content-Length")?
        .and_then(|value| value.parse::<usize>().ok())
        .is_some_and(|length| length > MAX_SOURCE_BYTES)
    {
        return unavailable_error("outline_unavailable", "Paper outline is unavailable", None);
    }
    let body = upstream.text().await?;
    if body.len() > MAX_SOURCE_BYTES {
        return unavailable_error("outline_unavailable", "Paper outline is unavailable", None);
    }
    let outline = parse(&body);
    let mut response = json_response(&outline, 200, None, PAPERS)?;
    edge::put(context, key, response.cloned()?);
    Ok(response)
}

fn parse(source: &str) -> Outline {
    let mut cursor = 0;
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
        if question_label(&label) {
            items.push(Heading {
                label: label.chars().take(160).collect(),
                anchor: anchor.into(),
                level,
            });
        }
    }
    Outline { items }
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
    use super::parse;

    #[test]
    fn extracts_only_real_question_headings_in_source_order() {
        let source = r#"
            <h1 id="h.intro"><span>Questions and corrections</span></h1>
            <h1 id="h.q1"><span>Question 1. (3 Marks)</span></h1>
            <h2 id="h.q1a">Question 1a &amp; working</h2>
            <h1 id="unsafe-anchor!">Question 2</h1>
            <h1 id="h.q3">Q3</h1>
        "#;
        let value = serde_json::to_value(parse(source)).unwrap();
        assert_eq!(value["items"].as_array().unwrap().len(), 3);
        assert_eq!(value["items"][0]["label"], "Question 1. (3 Marks)");
        assert_eq!(value["items"][1]["label"], "Question 1a & working");
        assert_eq!(value["items"][2]["anchor"], "h.q3");
    }
}
