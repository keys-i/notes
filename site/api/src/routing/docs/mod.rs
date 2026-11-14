//! Scalar API reference assets backed by the checked-in OpenAPI contract

use super::response::{asset_response, method_error};
use crate::shared::cache::policy::REFERENCE;
use worker::{Method, Request, Response, Result};

const PAGE: &str = include_str!("page.html");
const SCRIPT: &str = include_str!("reference.js");
const THEME: &str = include_str!("theme.css");
const OPENAPI: &str = include_str!("openapi.json");
const API_CSP: &str = "default-src 'none'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
const ASSET_CSP: &str = "default-src 'none'; frame-ancestors 'none'";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Asset {
    Page,
    Script,
    Theme,
    OpenApi,
}

pub(crate) fn route(path: &str) -> Option<Asset> {
    match path {
        "/api/docs" => Some(Asset::Page),
        "/api/reference.js" => Some(Asset::Script),
        "/api/theme.css" => Some(Asset::Theme),
        "/api/openapi.json" => Some(Asset::OpenApi),
        _ => None,
    }
}

pub(crate) fn respond(request: &Request, asset: Asset) -> Result<Response> {
    if !matches!(request.method(), Method::Get | Method::Head) {
        return method_error(
            "Use GET or HEAD for API reference assets",
            "GET, HEAD",
            None,
        );
    }
    match asset {
        Asset::Page => asset_response(PAGE, "text/html; charset=utf-8", REFERENCE, API_CSP),
        Asset::Script => asset_response(
            SCRIPT,
            "text/javascript; charset=utf-8",
            REFERENCE,
            ASSET_CSP,
        ),
        Asset::Theme => asset_response(THEME, "text/css; charset=utf-8", REFERENCE, ASSET_CSP),
        Asset::OpenApi => asset_response(
            OPENAPI,
            "application/vnd.oai.openapi+json;version=3.1; charset=utf-8",
            REFERENCE,
            ASSET_CSP,
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::{Asset, OPENAPI, SCRIPT, THEME, route};

    #[test]
    fn reference_routes_are_explicit_and_scalar_is_version_pinned() {
        assert_eq!(route("/api/docs"), Some(Asset::Page));
        assert_eq!(route("/api/openapi.json"), Some(Asset::OpenApi));
        assert_eq!(route("/api/reference.js"), Some(Asset::Script));
        assert_eq!(route("/api/theme.css"), Some(Asset::Theme));
        assert_eq!(route("/api/unknown"), None);
        assert!(SCRIPT.contains("@scalar/api-reference@1.78.0/esm.js"));
        assert!(SCRIPT.contains("Powered by NerdRage"));
        assert!(SCRIPT.contains("startViewTransition"));
        assert!(THEME.contains("#071aab"));
        assert!(THEME.contains("#ffff31"));
    }

    #[test]
    fn openapi_contract_is_valid_json_and_covers_every_service() {
        let contract: serde_json::Value = serde_json::from_str(OPENAPI).unwrap();
        assert_eq!(contract["openapi"], "3.1.0");
        for path in [
            "/api/pet",
            "/api/courses",
            "/api/courses/{course}",
            "/api/papers/{course}",
            "/api/papers/{course}/{document}/outline",
            "/api/manuals/freebsd",
            "/healthz",
            "/healthz/{service}",
            "/livez",
            "/readyz",
            "/metrics",
        ] {
            assert!(contract["paths"].get(path).is_some(), "missing {path}");
        }
        assert!(
            contract["components"]["schemas"]
                .get("CourseCatalogue")
                .is_some()
        );
        assert!(
            contract["paths"]["/healthz/{service}"]["get"]["parameters"][0]["schema"]["enum"]
                .as_array()
                .unwrap()
                .iter()
                .any(|service| service == "courses")
        );
    }
}
