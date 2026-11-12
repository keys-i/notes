//! Validated FreeBSD manual requests backed by the official renderer

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::LazyLock;
use worker::Url;

const SOURCE: &str = include_str!("../../../../config/manual.toml");

#[derive(Debug, Deserialize)]
struct Config {
    release: String,
    source: String,
    renderer: String,
    aliases: BTreeMap<String, String>,
}

#[derive(Debug, Serialize)]
pub(super) struct Metadata {
    release: String,
    source: String,
    renderer: String,
    aliases: BTreeMap<String, String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Query<'a> {
    Page { name: &'a str, section: &'a str },
    Search(&'a str),
}

static CONFIG: LazyLock<Result<Config, String>> =
    LazyLock::new(|| toml::from_str(SOURCE).map_err(|error| error.to_string()));
static READY: LazyLock<bool> = LazyLock::new(|| {
    metadata().is_ok()
        && upstream(Query::Page {
            name: "man",
            section: "1",
        })
        .is_ok()
});

pub(super) fn metadata() -> Result<Metadata, ()> {
    let config = CONFIG.as_ref().map_err(|_| ())?;
    Ok(Metadata {
        release: config.release.clone(),
        source: config.source.clone(),
        renderer: config.renderer.clone(),
        aliases: config.aliases.clone(),
    })
}

pub(super) fn ready() -> bool {
    *READY
}

fn valid_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'+'))
}

fn valid_search(value: &str) -> bool {
    !value.trim().is_empty() && value.chars().count() <= 64 && !value.chars().any(char::is_control)
}

pub(super) fn upstream(query: Query<'_>) -> Result<Url, ()> {
    let config = CONFIG.as_ref().map_err(|_| ())?;
    let mut url = Url::parse(&config.renderer).map_err(|_| ())?;
    if url.scheme() != "https" || url.host_str() != Some("man.freebsd.org") {
        return Err(());
    }
    let mut pairs = url.query_pairs_mut();
    match query {
        Query::Page { name, section }
            if valid_name(name)
                && (section == "0"
                    || (section.len() == 1
                        && section.as_bytes()[0].is_ascii_digit()
                        && section != "0")) =>
        {
            pairs
                .append_pair("query", name)
                .append_pair("sektion", section)
                .append_pair("format", "ascii");
        }
        Query::Search(value) if valid_search(value) => {
            pairs
                .append_pair("query", value.trim())
                .append_pair("sektion", "0")
                .append_pair("apropos", "1");
        }
        _ => return Err(()),
    }
    pairs.append_pair("manpath", &config.release);
    drop(pairs);
    Ok(url)
}

pub(super) fn valid_response(query: Query<'_>, body: &str) -> bool {
    if body.is_empty() || body.len() > 1_000_000 {
        return false;
    }
    match query {
        Query::Page { .. } => body.lines().next().is_some_and(|line| line.contains('(')),
        Query::Search(_) => body.contains("<dl") && body.contains("</dl>"),
    }
}

#[cfg(test)]
mod tests {
    use super::{Query, metadata, ready, upstream, valid_response};

    #[test]
    fn manual_queries_are_bounded_to_the_configured_freebsd_renderer() {
        assert!(ready());
        let metadata = metadata().unwrap();
        assert!(metadata.aliases.contains_key("help"));
        let page = upstream(Query::Page {
            name: "man",
            section: "1",
        })
        .unwrap();
        assert_eq!(page.host_str(), Some("man.freebsd.org"));
        assert!(page.query().unwrap().contains("query=man"));
        assert!(
            upstream(Query::Page {
                name: "../unsafe",
                section: "1"
            })
            .is_err()
        );
        assert!(valid_response(
            Query::Page {
                name: "man",
                section: "1"
            },
            "MAN(1)\nbody"
        ));
        assert!(valid_response(
            Query::Search("display"),
            "<dl><dt>man</dt></dl>"
        ));
    }
}
