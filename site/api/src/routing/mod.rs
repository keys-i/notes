//! URL dispatch for the Cloudflare Worker

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
    if let Some(probe) = health::route(&path) {
        return health::respond(&request, &env, probe);
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
    if let Some(code) = path.strip_prefix("/api/papers/") {
        return crate::service::papers::respond(&request, code);
    }
    if path == "/api/manuals/freebsd" {
        return crate::service::manuals::respond(&request, &context).await;
    }
    if path == "/api/pet" {
        return crate::service::koala::respond(request, env, context, started, origin).await;
    }
    json_error("not_found", "Route not found", 404, None)
}
