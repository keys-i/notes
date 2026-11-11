//! Liveness and dependency-readiness endpoints

use super::response::{json_error, json_response};
use crate::service::koala::{Client as ModelClient, PROMPT_VERSION};
use crate::shared::cache::policy::NO_STORE;
use worker::{Env, Method, Request, Response, Result};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Probe {
    Live,
    Ready,
}

pub(crate) fn route(path: &str) -> Option<Probe> {
    match path {
        "/healthz" | "/livez" => Some(Probe::Live),
        "/readyz" => Some(Probe::Ready),
        _ => None,
    }
}

pub(crate) fn respond(request: &Request, env: &Env, probe: Probe) -> Result<Response> {
    if !matches!(request.method(), Method::Get | Method::Head) {
        let mut response = json_error("method_not_allowed", "Use GET for probes", 405, None)?;
        response.headers_mut().set("Allow", "GET, HEAD")?;
        return Ok(response);
    }
    let available = probe == Probe::Live
        || (ModelClient::from_env(env).is_ok() && env.rate_limiter("PET_LIMIT").is_ok());
    let status = if available { 200 } else { 503 };
    let body = serde_json::json!({
        "service": "notes-pet",
        "status": if available { "ok" } else { "unavailable" },
        "version": PROMPT_VERSION,
    });
    let mut response = json_response(&body, status, None, NO_STORE)?;
    if !available {
        response.headers_mut().set("Retry-After", "30")?;
    }
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::{Probe, route};

    #[test]
    fn paths_separate_process_liveness_from_dependency_readiness() {
        assert_eq!(route("/healthz"), Some(Probe::Live));
        assert_eq!(route("/livez"), Some(Probe::Live));
        assert_eq!(route("/readyz"), Some(Probe::Ready));
        assert_eq!(route("/api/pet"), None);
    }
}
