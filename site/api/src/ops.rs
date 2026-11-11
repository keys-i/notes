//! Health probes, hardened responses, metrics and structured request logs

use crate::study::PROMPT_VERSION;
use serde::Serialize;
use worker::{Date, Env, Headers, Response, Result};

#[derive(Debug, Serialize)]
struct ApiError {
    error: ErrorBody,
}

#[derive(Debug, Serialize)]
struct ErrorBody {
    code: &'static str,
    message: &'static str,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Probe {
    Live,
    Ready,
}

pub(crate) fn probe_route(path: &str) -> Option<Probe> {
    match path {
        "/healthz" | "/livez" => Some(Probe::Live),
        "/readyz" => Some(Probe::Ready),
        _ => None,
    }
}

pub(crate) fn metric_line(outcome: &str, model: &str, cached: bool, latency_ms: u64) -> String {
    serde_json::json!({
        "cached": cached,
        "event": "pet_request",
        "latency_ms": latency_ms,
        "model": model,
        "outcome": outcome,
        "version": PROMPT_VERSION,
    })
    .to_string()
}

pub(crate) fn metric(_env: &Env, outcome: &str, model: &str, cached: bool, started: u64) {
    worker::console_log!(
        "{}",
        metric_line(
            outcome,
            model,
            cached,
            Date::now().as_millis().saturating_sub(started),
        )
    );
}

pub(crate) fn request_log_line(
    request_id: &str,
    method: &str,
    path: &str,
    status: u16,
    latency_ms: u64,
) -> String {
    serde_json::json!({
        "event": "http_request",
        "latency_ms": latency_ms,
        "method": method,
        "path": path,
        "request_id": request_id,
        "status": status,
        "version": PROMPT_VERSION,
    })
    .to_string()
}

pub(crate) fn preflight(origin: Option<&str>) -> Result<Response> {
    let response = Response::empty()?.with_status(204);
    secure_response(response, origin, "public, max-age=86400")
}

pub(crate) fn json_response<T: Serialize>(
    body: &T,
    status: u16,
    origin: Option<&str>,
    cache_control: &str,
) -> Result<Response> {
    let response = Response::from_json(body)?.with_status(status);
    secure_response(response, origin, cache_control)
}

pub(crate) fn json_error(
    code: &'static str,
    message: &'static str,
    status: u16,
    origin: Option<&str>,
) -> Result<Response> {
    json_response(
        &ApiError {
            error: ErrorBody { code, message },
        },
        status,
        origin,
        "no-store",
    )
}

pub(crate) fn unavailable_error(
    code: &'static str,
    message: &'static str,
    origin: Option<&str>,
) -> Result<Response> {
    let mut response = json_error(code, message, 503, origin)?;
    response.headers_mut().set("Retry-After", "30")?;
    Ok(response)
}

fn secure_response(
    mut response: Response,
    origin: Option<&str>,
    cache_control: &str,
) -> Result<Response> {
    let headers: &mut Headers = response.headers_mut();
    headers.set("Cache-Control", cache_control)?;
    headers.set(
        "Content-Security-Policy",
        "default-src 'none'; frame-ancestors 'none'",
    )?;
    headers.set("Cross-Origin-Resource-Policy", "same-site")?;
    headers.set(
        "Permissions-Policy",
        "camera=(), geolocation=(), microphone=()",
    )?;
    headers.set("Referrer-Policy", "no-referrer")?;
    headers.set("Strict-Transport-Security", "max-age=31536000")?;
    headers.set("X-Content-Type-Options", "nosniff")?;
    headers.set("X-Frame-Options", "DENY")?;
    if let Some(origin) = origin {
        headers.set("Access-Control-Allow-Origin", origin)?;
        headers.set("Access-Control-Allow-Headers", "Content-Type")?;
        headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")?;
        headers.set("Access-Control-Max-Age", "86400")?;
        headers.set("Vary", "Origin")?;
    }
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::{Probe, metric_line, probe_route, request_log_line};
    use crate::study::PROMPT_VERSION;

    #[test]
    fn telemetry_contains_only_bounded_operational_fields() {
        let value: serde_json::Value =
            serde_json::from_str(&metric_line("ok", "fast", true, 42)).unwrap();
        let object = value.as_object().unwrap();
        assert_eq!(object.len(), 6);
        assert_eq!(value["event"], "pet_request");
        assert_eq!(value["outcome"], "ok");
        assert_eq!(value["model"], "fast");
        assert_eq!(value["cached"], true);
        assert_eq!(value["latency_ms"], 42);
        assert_eq!(value["version"], PROMPT_VERSION);
    }

    #[test]
    fn probes_separate_process_liveness_from_dependency_readiness() {
        assert_eq!(probe_route("/healthz"), Some(Probe::Live));
        assert_eq!(probe_route("/livez"), Some(Probe::Live));
        assert_eq!(probe_route("/readyz"), Some(Probe::Ready));
        assert_eq!(probe_route("/api/pet"), None);
    }

    #[test]
    fn request_logs_are_correlatable_without_user_content() {
        let value: serde_json::Value =
            serde_json::from_str(&request_log_line("cf-ray-123", "POST", "/api/pet", 200, 48))
                .unwrap();
        assert_eq!(value["event"], "http_request");
        assert_eq!(value["request_id"], "cf-ray-123");
        assert_eq!(value["method"], "POST");
        assert_eq!(value["path"], "/api/pet");
        assert_eq!(value["status"], 200);
        assert_eq!(value["latency_ms"], 48);
        assert!(value.get("body").is_none());
    }
}
