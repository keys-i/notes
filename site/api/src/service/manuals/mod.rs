//! FreeBSD manual configuration, validation and edge-backed responses

mod config;

use crate::routing::response::{json_error, json_response, method_error, unavailable_error};
use crate::shared::cache::{edge, policy::MANUALS, short_hash};
use config::Query;
use worker::{Context, Fetch, Method, Request, Response, Result};

pub(crate) async fn respond(request: &Request, context: &Context) -> Result<Response> {
    if request.method() != Method::Get {
        return method_error("Use GET for manual pages", "GET, OPTIONS", None);
    }
    let url = request.url()?;
    let name = url
        .query_pairs()
        .find_map(|(key, value)| (key == "name").then(|| value.into_owned()));
    let search = url
        .query_pairs()
        .find_map(|(key, value)| (key == "search").then(|| value.into_owned()));
    if name.is_none() && search.is_none() {
        return match config::metadata() {
            Ok(metadata) => json_response(&metadata, 200, None, MANUALS),
            Err(()) => {
                unavailable_error("manual_unavailable", "Manual service is unavailable", None)
            }
        };
    }
    let section = url
        .query_pairs()
        .find_map(|(key, value)| (key == "section").then(|| value.into_owned()))
        .unwrap_or_else(|| "0".into());
    let query = match (name.as_deref(), search.as_deref()) {
        (Some(name), None) => Query::Page {
            name,
            section: &section,
        },
        (None, Some(search)) => Query::Search(search),
        _ => return json_error("invalid_manual_query", "Invalid manual query", 400, None),
    };
    let upstream = match config::upstream(query) {
        Ok(url) => url,
        Err(()) => return json_error("invalid_manual_query", "Invalid manual query", 400, None),
    };
    let key = format!(
        "https://manual-cache.invalid/{}",
        short_hash(upstream.as_str().as_bytes())
    );
    match edge::response(&key).await {
        Ok(Some(response)) => return Ok(response),
        Ok(None) => {}
        Err(error) => worker::console_error!("Manual cache read failed: {error}"),
    }
    let mut response = match Fetch::Url(upstream).send().await {
        Ok(response) if response.status_code() == 200 => response,
        _ => {
            return unavailable_error("manual_unavailable", "Manual service is unavailable", None);
        }
    };
    let body = response.text().await?;
    if !config::valid_response(query, &body) {
        return unavailable_error("manual_unavailable", "Manual service is unavailable", None);
    }
    let kind = match query {
        Query::Page { .. } => "page",
        Query::Search(_) => "search",
    };
    let payload = serde_json::json!({"body": body, "kind": kind});
    let mut response = json_response(&payload, 200, None, MANUALS)?;
    let cached = response.cloned()?;
    edge::put(context, key, cached);
    Ok(response)
}
