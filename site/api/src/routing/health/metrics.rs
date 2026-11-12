//! Prometheus exposition with bounded low-cardinality labels

use super::super::response::{asset_response, json_error, unavailable_error};
use super::Checks;
use crate::shared::cache::policy::NO_STORE;
use sha2::{Digest, Sha256};
use worker::{Env, Method, Request, Response, Result};

const TOKEN_SECRET: &str = "METRICS_GATEWAY_TOKEN";
const TOKEN_LIMIT: usize = 4096;
const METRICS_CSP: &str = "default-src 'none'; frame-ancestors 'none'";

pub(super) fn respond(request: &Request, env: &Env) -> Result<Response> {
    if !matches!(request.method(), Method::Get | Method::Head) {
        let mut response = json_error(
            "method_not_allowed",
            "Use GET or HEAD for metrics",
            405,
            None,
        )?;
        response.headers_mut().set("Allow", "GET, HEAD")?;
        return Ok(response);
    }
    let expected = match env.secret(TOKEN_SECRET) {
        Ok(secret) => secret.to_string(),
        Err(_) => {
            return unavailable_error(
                "metrics_unavailable",
                "Metrics gateway authentication is unavailable",
                None,
            );
        }
    };
    let presented = request
        .headers()
        .get("Authorization")?
        .and_then(|value| value.strip_prefix("Bearer ").map(str::to_owned));
    if presented.as_deref().is_none_or(|token| {
        token.is_empty()
            || token.len() > TOKEN_LIMIT
            || token.chars().any(char::is_control)
            || !secure_equal(token.as_bytes(), expected.as_bytes())
    }) {
        let mut response = json_error(
            "metrics_forbidden",
            "Metrics are available only to gw.keysi.dev",
            403,
            None,
        )?;
        response
            .headers_mut()
            .set("WWW-Authenticate", "Bearer realm=\"metrics\"")?;
        return Ok(response);
    }
    asset_response(
        &prometheus(Checks::read(env)),
        "text/plain; version=0.0.4; charset=utf-8",
        NO_STORE,
        METRICS_CSP,
    )
}

fn gauge(ready: bool) -> u8 {
    u8::from(ready)
}

pub(super) fn prometheus(checks: Checks) -> String {
    format!(
        "# HELP notes_api_up Whether the Worker can execute requests\n\
# TYPE notes_api_up gauge\n\
notes_api_up 1\n\
# HELP notes_api_ready Whether every required API service is ready\n\
# TYPE notes_api_ready gauge\n\
notes_api_ready {}\n\
# HELP notes_api_service_ready Whether an API service can accept traffic\n\
# TYPE notes_api_service_ready gauge\n\
notes_api_service_ready{{service=\"koala\"}} {}\n\
notes_api_service_ready{{service=\"manuals\"}} {}\n\
notes_api_service_ready{{service=\"papers\"}} {}\n",
        gauge(checks.all_ready()),
        gauge(checks.koala.ready()),
        gauge(checks.manuals),
        gauge(checks.papers),
    )
}

fn secure_equal(left: &[u8], right: &[u8]) -> bool {
    let left = Sha256::digest(left);
    let right = Sha256::digest(right);
    left.iter()
        .zip(right)
        .fold(0, |difference, (left, right)| difference | (left ^ right))
        == 0
}

#[cfg(test)]
mod tests {
    use super::{prometheus, secure_equal};
    use crate::routing::health::Checks;
    use crate::service::koala;

    #[test]
    fn metrics_expose_stable_low_cardinality_gauges() {
        let body = prometheus(Checks {
            koala: koala::Readiness {
                model: false,
                rate_limit: true,
            },
            manuals: true,
            papers: true,
        });
        assert!(body.contains("notes_api_up 1"));
        assert!(body.contains("notes_api_ready 0"));
        assert!(body.contains("notes_api_service_ready{service=\"koala\"} 0"));
        assert!(body.contains("notes_api_service_ready{service=\"manuals\"} 1"));
        assert!(!body.contains("MODEL_API_KEY"));
    }

    #[test]
    fn gateway_tokens_use_a_fixed_size_comparison() {
        assert!(secure_equal(b"gateway-token", b"gateway-token"));
        assert!(!secure_equal(b"gateway-token", b"wrong-token"));
        assert!(!secure_equal(b"gateway-token", b"gateway-token-extra"));
    }
}
