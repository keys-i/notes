//! Cloudflare Worker request lifecycle and route ownership

use crate::input::{PetRequest, validate, validation_code};
use crate::model::Client as ModelClient;
use crate::ops::{Probe, json_error, json_response, preflight, probe_route, request_log_line};
use crate::study::PROMPT_VERSION;
use futures_util::StreamExt;
use worker::{Context, Date, Env, Method, Request, Response, Result, event};

const MAX_BODY_BYTES: usize = 2_900_000;
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
    let result = handle(request, env, context).await;
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

async fn handle(mut request: Request, env: Env, context: Context) -> Result<Response> {
    let started = Date::now().as_millis();
    let path = request.path();
    if let Some(probe) = probe_route(&path) {
        if !matches!(request.method(), Method::Get | Method::Head) {
            let mut response = json_error("method_not_allowed", "Use GET for probes", 405, None)?;
            response.headers_mut().set("Allow", "GET, HEAD")?;
            return Ok(response);
        }
        let available = probe == Probe::Live
            || (ModelClient::from_env(&env).is_ok() && env.rate_limiter("PET_LIMIT").is_ok());
        let status = if available { 200 } else { 503 };
        let response = serde_json::json!({
            "service": "notes-pet",
            "status": if available { "ok" } else { "unavailable" },
            "version": PROMPT_VERSION,
        });
        let mut response = json_response(&response, status, None, "no-store")?;
        if !available {
            response.headers_mut().set("Retry-After", "30")?;
        }
        return Ok(response);
    }
    if path != "/api/pet" {
        return json_error("not_found", "Route not found", 404, None);
    }

    let origin = request.headers().get("Origin")?;
    if origin
        .as_deref()
        .is_some_and(|value| !allowed_origin(value))
    {
        return json_error("origin_denied", "Origin is not allowed", 403, None);
    }
    if request.method() == Method::Options {
        return preflight(origin.as_deref());
    }
    if request.method() != Method::Post {
        let mut response = json_error(
            "method_not_allowed",
            "Use POST for study questions",
            405,
            origin.as_deref(),
        )?;
        response.headers_mut().set("Allow", "POST, OPTIONS")?;
        return Ok(response);
    }
    if request
        .headers()
        .get("Content-Type")?
        .as_deref()
        .is_none_or(|value| !value.starts_with("application/json"))
    {
        return json_error(
            "unsupported_media_type",
            "Content-Type must be application/json",
            415,
            origin.as_deref(),
        );
    }
    if request
        .headers()
        .get("Content-Encoding")?
        .as_deref()
        .is_some_and(|value| value != "identity")
    {
        return json_error(
            "unsupported_encoding",
            "Compressed study requests are not accepted",
            415,
            origin.as_deref(),
        );
    }

    let mut body = Vec::new();
    let mut stream = match request.stream() {
        Ok(stream) => stream,
        Err(_) => {
            return json_error(
                "invalid_json",
                "Request body is not valid JSON",
                400,
                origin.as_deref(),
            );
        }
    };
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        if append_bounded(&mut body, &chunk, MAX_BODY_BYTES).is_err() {
            return json_error(
                "request_too_large",
                "Study request is too large",
                413,
                origin.as_deref(),
            );
        }
    }
    let input = match serde_json::from_slice::<PetRequest>(&body) {
        Ok(input) => match validate(input) {
            Ok(input) => input,
            Err(message) => {
                return json_error(validation_code(message), message, 422, origin.as_deref());
            }
        },
        Err(_) => {
            return json_error(
                "invalid_json",
                "Request body is not valid JSON",
                400,
                origin.as_deref(),
            );
        }
    };
    let client = request
        .headers()
        .get("CF-Connecting-IP")?
        .unwrap_or_else(|| "unknown".into());
    crate::answer::answer(input, client, env, context, started, origin).await
}

fn append_bounded(body: &mut Vec<u8>, chunk: &[u8], maximum: usize) -> Result<(), ()> {
    if chunk.len() > maximum.saturating_sub(body.len()) {
        return Err(());
    }
    body.extend_from_slice(chunk);
    Ok(())
}

fn allowed_origin(origin: &str) -> bool {
    ALLOWED_ORIGINS.contains(&origin)
}

#[cfg(test)]
#[path = "worker_tests.rs"]
mod tests;
