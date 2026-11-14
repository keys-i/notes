//! UQ course catalogue configuration and responses

mod config;

use crate::routing::response::{json_error, json_response, method_error, unavailable_error};
use crate::shared::cache::policy::COURSES;
use worker::{Method, Request, Response, Result};

pub(crate) fn ready() -> bool {
    config::ready()
}

pub(crate) fn respond(request: &Request, code: Option<&str>, now_ms: u64) -> Result<Response> {
    if request.method() != Method::Get {
        return method_error("Use GET for course catalogues", "GET, OPTIONS", None);
    }
    match code {
        Some(code) => match config::course(code, now_ms) {
            Ok(Some(course)) => json_response(&course, 200, None, COURSES),
            Ok(None) => json_error("not_found", "Course not found", 404, None),
            Err(_) => unavailable(),
        },
        None => match config::catalog(now_ms) {
            Ok(catalog) => json_response(&catalog, 200, None, COURSES),
            Err(_) => unavailable(),
        },
    }
}

fn unavailable() -> Result<Response> {
    unavailable_error(
        "catalogue_unavailable",
        "Course catalogue is unavailable",
        None,
    )
}
