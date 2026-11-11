//! JSON envelopes, CORS and security headers shared by every route

use crate::shared::cache::policy::{NO_STORE, PREFLIGHT};
use serde::Serialize;
use worker::{Headers, Response, Result};

#[derive(Debug, Serialize)]
struct ApiError {
    error: ErrorBody,
}

#[derive(Debug, Serialize)]
struct ErrorBody {
    code: &'static str,
    message: &'static str,
}

pub(crate) fn preflight(origin: Option<&str>) -> Result<Response> {
    let response = Response::empty()?.with_status(204);
    secure(response, origin, PREFLIGHT)
}

pub(crate) fn json_response<T: Serialize>(
    body: &T,
    status: u16,
    origin: Option<&str>,
    cache_control: &str,
) -> Result<Response> {
    let response = Response::from_json(body)?.with_status(status);
    secure(response, origin, cache_control)
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
        NO_STORE,
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

pub(crate) fn method_error(
    message: &'static str,
    allow: &'static str,
    origin: Option<&str>,
) -> Result<Response> {
    let mut response = json_error("method_not_allowed", message, 405, origin)?;
    response.headers_mut().set("Allow", allow)?;
    Ok(response)
}

fn secure(mut response: Response, origin: Option<&str>, cache_control: &str) -> Result<Response> {
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
        headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")?;
        headers.set("Access-Control-Max-Age", "86400")?;
        headers.set("Vary", "Origin")?;
    }
    Ok(response)
}
