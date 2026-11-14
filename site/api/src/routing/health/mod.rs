//! API-wide liveness, readiness and service diagnostics

mod metrics;
mod report;

use super::response::{json_error, json_response};
use crate::service::{courses, koala, manuals, papers};
use crate::shared::cache::policy::NO_STORE;
use report::{live_report, report};
use worker::{Date, Env, Method, Request, Response, Result};

pub(super) const API_NAME: &str = "notes-api";
pub(super) const API_VERSION: &str = env!("CARGO_PKG_VERSION");
pub(super) const SERVICE_COUNT: u8 = 4;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Service {
    Courses,
    Koala,
    Manuals,
    Papers,
}

impl Service {
    pub(super) fn name(self) -> &'static str {
        match self {
            Self::Courses => "courses",
            Self::Koala => "koala",
            Self::Manuals => "manuals",
            Self::Papers => "papers",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Probe {
    Health(Option<Service>),
    Live,
    Ready,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Route {
    Probe(Probe),
    Metrics,
}

#[derive(Clone, Copy, Debug)]
pub(super) struct Checks {
    pub(super) courses: bool,
    pub(super) koala: koala::Readiness,
    pub(super) manuals: bool,
    pub(super) papers: bool,
}

impl Checks {
    fn read(env: &Env) -> Self {
        Self {
            courses: courses::ready(),
            koala: koala::readiness(env),
            manuals: manuals::ready(),
            papers: papers::ready(),
        }
    }

    pub(super) fn service_ready(self, service: Service) -> bool {
        match service {
            Service::Courses => self.courses,
            Service::Koala => self.koala.ready(),
            Service::Manuals => self.manuals,
            Service::Papers => self.papers,
        }
    }

    pub(super) fn ready_count(self) -> u8 {
        [self.courses, self.koala.ready(), self.manuals, self.papers]
            .into_iter()
            .filter(|ready| *ready)
            .count() as u8
    }

    pub(super) fn all_ready(self) -> bool {
        self.ready_count() == SERVICE_COUNT
    }
}

pub(crate) fn route(path: &str) -> Option<Route> {
    match path {
        "/healthz" => Some(Route::Probe(Probe::Health(None))),
        "/healthz/courses" => Some(Route::Probe(Probe::Health(Some(Service::Courses)))),
        "/healthz/koala" => Some(Route::Probe(Probe::Health(Some(Service::Koala)))),
        "/healthz/manuals" => Some(Route::Probe(Probe::Health(Some(Service::Manuals)))),
        "/healthz/papers" => Some(Route::Probe(Probe::Health(Some(Service::Papers)))),
        "/livez" => Some(Route::Probe(Probe::Live)),
        "/readyz" => Some(Route::Probe(Probe::Ready)),
        "/metrics" => Some(Route::Metrics),
        _ => None,
    }
}

pub(crate) fn respond(request: &Request, env: &Env, route: Route) -> Result<Response> {
    match route {
        Route::Probe(probe) => probe_response(request, env, probe),
        Route::Metrics => metrics::respond(request, env),
    }
}

fn probe_response(request: &Request, env: &Env, probe: Probe) -> Result<Response> {
    if !matches!(request.method(), Method::Get | Method::Head) {
        let mut response = json_error(
            "method_not_allowed",
            "Use GET or HEAD for probes",
            405,
            None,
        )?;
        response.headers_mut().set("Allow", "GET, HEAD")?;
        return Ok(response);
    }
    let checked_at_ms = Date::now().as_millis();
    let (body, status) = match probe {
        Probe::Live => live_report(checked_at_ms),
        probe => report(probe, Checks::read(env), checked_at_ms),
    };
    let mut response = json_response(&body, status, None, NO_STORE)?;
    if status == 503 {
        response.headers_mut().set("Retry-After", "30")?;
    }
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::{Probe, Route, SERVICE_COUNT, Service, route};

    #[test]
    fn paths_separate_runtime_and_service_diagnostics() {
        assert_eq!(SERVICE_COUNT, 4);
        assert_eq!(route("/healthz"), Some(Route::Probe(Probe::Health(None))));
        assert_eq!(
            route("/healthz/courses"),
            Some(Route::Probe(Probe::Health(Some(Service::Courses))))
        );
        assert_eq!(
            route("/healthz/koala"),
            Some(Route::Probe(Probe::Health(Some(Service::Koala))))
        );
        assert_eq!(
            route("/healthz/manuals"),
            Some(Route::Probe(Probe::Health(Some(Service::Manuals))))
        );
        assert_eq!(
            route("/healthz/papers"),
            Some(Route::Probe(Probe::Health(Some(Service::Papers))))
        );
        assert_eq!(route("/livez"), Some(Route::Probe(Probe::Live)));
        assert_eq!(route("/readyz"), Some(Route::Probe(Probe::Ready)));
        assert_eq!(route("/metrics"), Some(Route::Metrics));
        assert_eq!(route("/healthz/unknown"), None);
    }
}
