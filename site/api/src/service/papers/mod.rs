//! Course paper configuration, validation and responses

mod config;
mod outline;

use crate::routing::response::{json_error, json_response, method_error, unavailable_error};
use crate::shared::cache::policy::PAPERS;
use worker::{Method, Request, Response, Result};

pub(crate) fn ready() -> bool {
    config::ready()
}

pub(crate) fn respond(request: &Request, code: &str) -> Result<Response> {
    if request.method() != Method::Get {
        return method_error("Use GET for paper catalogues", "GET, OPTIONS", None);
    }
    match config::catalog(code) {
        Ok(Some(catalog)) => json_response(&catalog, 200, None, PAPERS),
        Ok(None) => json_error("not_found", "Course catalogue not found", 404, None),
        Err(()) => unavailable_error(
            "catalogue_unavailable",
            "Paper catalogue is unavailable",
            None,
        ),
    }
}

pub(crate) async fn outline(
    request: &Request,
    code: &str,
    id: &str,
    context: &worker::Context,
) -> Result<Response> {
    outline::respond(request, code, id, context).await
}
