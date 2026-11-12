//! Course-scoped paper catalogues compiled from the editable TOML source

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::sync::LazyLock;

const SOURCE: &str = include_str!("../../../../config/papers.toml");

#[derive(Debug, Deserialize)]
struct Config {
    updated: String,
    courses: BTreeMap<String, Course>,
}

#[derive(Debug, Deserialize)]
struct Course {
    #[serde(rename = "folder-code")]
    folder_code: String,
    #[serde(rename = "archive-code")]
    archive_code: Option<String>,
    items: Vec<SourceItem>,
}

#[derive(Debug, Deserialize)]
struct SourceItem {
    title: String,
    year: u16,
    #[serde(default = "paper_kind")]
    kind: String,
    #[serde(rename = "url-code")]
    url_code: String,
    #[serde(default = "fallback_source")]
    source: String,
    #[serde(default)]
    solutions: bool,
}

#[derive(Debug, Serialize)]
pub(super) struct Catalog {
    updated: String,
    folder: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    archive: Option<String>,
    items: Vec<Item>,
}

#[derive(Debug, Serialize)]
struct Item {
    title: String,
    year: u16,
    kind: String,
    url: String,
}

static CONFIG: LazyLock<Result<Config, String>> =
    LazyLock::new(|| toml::from_str(SOURCE).map_err(|error| error.to_string()));
static READY: LazyLock<bool> = LazyLock::new(|| {
    let Ok(config) = CONFIG.as_ref() else {
        return false;
    };
    !config.courses.is_empty()
        && config
            .courses
            .keys()
            .all(|code| matches!(catalog(code), Ok(Some(_))))
});

fn paper_kind() -> String {
    "paper".into()
}

fn fallback_source() -> String {
    "fallback".into()
}

fn identifier(value: &str) -> bool {
    (10..=128).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn split_code(value: &str) -> Option<(&str, Option<&str>)> {
    let (code, query) = value
        .split_once('?')
        .map_or((value, None), |(code, query)| (code, Some(query)));
    let resource = match query {
        Some(query) => query
            .strip_prefix("resourcekey=")
            .filter(|key| identifier(key))?,
        None => "",
    };
    Some((code, (!resource.is_empty()).then_some(resource)))
}

fn folder_url(value: &str) -> Option<String> {
    let (identifier_value, resource) = split_code(value)?;
    if !identifier(identifier_value) {
        return None;
    }
    let mut url = format!("https://drive.google.com/drive/folders/{identifier_value}");
    if let Some(resource) = resource {
        url.push_str("?resourcekey=");
        url.push_str(resource);
    }
    Some(url)
}

fn item_url(value: &str) -> Option<String> {
    let (code, resource) = split_code(value)?;
    let (kind, identifier_value) = code.split_once('/')?;
    if !identifier(identifier_value) {
        return None;
    }
    let mut url = match kind {
        "document" => format!("https://docs.google.com/document/d/{identifier_value}/edit"),
        "file" => format!("https://drive.google.com/file/d/{identifier_value}/view"),
        _ => return None,
    };
    if let Some(resource) = resource {
        url.push_str("?resourcekey=");
        url.push_str(resource);
    }
    Some(url)
}

fn valid_title(value: &str) -> bool {
    !value.trim().is_empty() && value.chars().count() <= 120 && !value.chars().any(char::is_control)
}

pub(super) fn catalog(code: &str) -> Result<Option<Catalog>, ()> {
    let config = CONFIG.as_ref().map_err(|_| ())?;
    let Some(course) = config.courses.get(code) else {
        return Ok(None);
    };
    let folder = folder_url(&course.folder_code).ok_or(())?;
    let archive = match course.archive_code.as_deref() {
        Some(code) => Some(folder_url(code).ok_or(())?),
        None => None,
    };
    let mut seen = HashSet::new();
    let mut items = Vec::new();
    for source in ["primary", "fallback"] {
        for item in course.items.iter().filter(|item| item.source == source) {
            if !item.solutions {
                continue;
            }
            if !valid_title(&item.title)
                || !(1900..=2100).contains(&item.year)
                || !matches!(item.kind.as_str(), "paper" | "practice" | "solution")
            {
                return Err(());
            }
            let key = (item.year, item.title.to_lowercase());
            if seen.insert(key) {
                items.push(Item {
                    title: item.title.clone(),
                    year: item.year,
                    kind: item.kind.clone(),
                    url: item_url(&item.url_code).ok_or(())?,
                });
            }
        }
    }
    if course
        .items
        .iter()
        .any(|item| !matches!(item.source.as_str(), "primary" | "fallback"))
    {
        return Err(());
    }
    items.sort_by_key(|item| std::cmp::Reverse(item.year));
    Ok(Some(Catalog {
        updated: config.updated.clone(),
        folder,
        archive,
        items,
    }))
}

pub(super) fn ready() -> bool {
    *READY
}

#[cfg(test)]
mod tests {
    use super::{catalog, item_url, ready};

    #[test]
    fn catalogue_expands_only_safe_google_codes_and_prefers_primary_items() {
        assert!(ready());
        let infs = catalog("INFS2200").unwrap().unwrap();
        let value = serde_json::to_value(infs).unwrap();
        let items = value["items"].as_array().unwrap();
        assert!(!items.is_empty());
        assert!(items.iter().all(|item| {
            item["url"].as_str().is_some_and(|url| {
                url.starts_with("https://docs.google.com/")
                    || url.starts_with("https://drive.google.com/")
            })
        }));
        assert_eq!(
            items
                .iter()
                .filter(|item| item["year"] == 2019 && item["title"] == "Exam with answers")
                .count(),
            1
        );
        assert!(catalog("UNKNOWN").unwrap().is_none());
        assert!(item_url("https://example.test/file").is_none());
    }
}
