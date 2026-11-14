//! URL dispatch for the Cloudflare Worker

mod docs;
mod health;
pub(crate) mod response;
pub(crate) mod telemetry;

use response::{json_error, preflight};
use telemetry::request_log_line;
use worker::{Context, Date, Env, Method, Request, Response, Result, event};

const ALLOWED_ORIGINS: &[&str] = &[
    "https://uni.keysi.dev",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8765",
    "http://localhost:8000",
    "http://localhost:8765",
];

#[event(fetch)]
async fn main(request: Request, env: Env, context: Context) -> Result<Response> {
    let started = Date::now().as_millis();
    let path = request.path();
    let method = request.method().to_string();
    let request_id = request
        .headers()
        .get("CF-Ray")?
        .filter(|value| {
            !value.is_empty()
                && value.len() <= 96
                && value
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
        })
        .unwrap_or_else(|| format!("local-{started}"));
    let result = dispatch(request, env, context, started).await;
    let latency = Date::now().as_millis().saturating_sub(started);
    match result {
        Ok(mut response) => {
            let status = response.status_code();
            response.headers_mut().set("X-Request-ID", &request_id)?;
            response
                .headers_mut()
                .set("Server-Timing", &format!("app;dur={latency}"))?;
            worker::console_log!(
                "{}",
                request_log_line(&request_id, &method, &path, status, latency)
            );
            Ok(response)
        }
        Err(error) => {
            worker::console_error!(
                "{}",
                request_log_line(&request_id, &method, &path, 500, latency)
            );
            Err(error)
        }
    }
}

async fn dispatch(request: Request, env: Env, context: Context, started: u64) -> Result<Response> {
    let path = request.path();
    if let Some(route) = health::route(&path) {
        return health::respond(&request, &env, route);
    }

    let origin = request.headers().get("Origin")?;
    if origin
        .as_deref()
        .is_some_and(|value| !ALLOWED_ORIGINS.contains(&value))
    {
        return json_error("origin_denied", "Origin is not allowed", 403, None);
    }
    if request.method() == Method::Options {
        return preflight(origin.as_deref());
    }
    if let Some(asset) = docs::route(&path) {
        return docs::respond(&request, asset);
    }
    if let Some(code) = course_route(&path) {
        return crate::service::courses::respond(&request, code, started);
    }
    if let Some(route) = paper_route(&path) {
        return match route {
            PaperRoute::Catalog(code) => crate::service::papers::respond(&request, code),
            PaperRoute::Outline { code, id } => {
                crate::service::papers::outline(&request, code, id, &context).await
            }
        };
    }
    if path == "/api/manuals/freebsd" {
        return crate::service::manuals::respond(&request, &context).await;
    }
    if path == "/api/pet" {
        return crate::service::koala::respond(request, env, context, started, origin).await;
    }
    json_error("not_found", "Route not found", 404, None)
}

#[derive(Debug, PartialEq, Eq)]
enum PaperRoute<'a> {
    Catalog(&'a str),
    Outline { code: &'a str, id: &'a str },
}

fn paper_route(path: &str) -> Option<PaperRoute<'_>> {
    let mut parts = path.strip_prefix("/api/papers/")?.split('/');
    match (parts.next(), parts.next(), parts.next(), parts.next()) {
        (Some(code), None, None, None) if !code.is_empty() => Some(PaperRoute::Catalog(code)),
        (Some(code), Some(id), Some("outline"), None) if !code.is_empty() && !id.is_empty() => {
            Some(PaperRoute::Outline { code, id })
        }
        _ => None,
    }
}

fn course_route(path: &str) -> Option<Option<&str>> {
    if path == "/api/courses" {
        return Some(None);
    }
    path.strip_prefix("/api/courses/")
        .filter(|code| !code.is_empty() && !code.contains('/'))
        .map(Some)
}

#[cfg(test)]
mod tests {
    use super::{PaperRoute, course_route, paper_route};

    #[test]
    fn course_routes_match_only_the_list_and_one_code() {
        assert_eq!(course_route("/api/courses"), Some(None));
        assert_eq!(
            course_route("/api/courses/COMP4702"),
            Some(Some("COMP4702"))
        );
        assert_eq!(course_route("/api/courses/"), None);
        assert_eq!(course_route("/api/courses/COMP4702/"), None);
        assert_eq!(course_route("/api/courses/COMP4702/extra"), None);
        assert_eq!(course_route("/api/course/COMP4702"), None);
    }

    #[test]
    fn paper_routes_match_catalogues_and_one_outline() {
        assert_eq!(
            paper_route("/api/papers/INFS2200"),
            Some(PaperRoute::Catalog("INFS2200"))
        );
        assert_eq!(
            paper_route("/api/papers/INFS2200/doc-id/outline"),
            Some(PaperRoute::Outline {
                code: "INFS2200",
                id: "doc-id"
            })
        );
        assert_eq!(paper_route("/api/papers/INFS2200/"), None);
        assert_eq!(paper_route("/api/papers/INFS2200/doc-id"), None);
        assert_eq!(
            paper_route("/api/papers/INFS2200/doc-id/outline/more"),
            None
        );
    }
}
