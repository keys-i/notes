//! JSON health reports for operators and load balancers

use super::{API_NAME, API_VERSION, Checks, Probe, SERVICE_COUNT, Service};
use crate::service::koala;
use serde_json::{Value, json};

fn state(ready: bool) -> &'static str {
    if ready { "ok" } else { "unavailable" }
}

fn service_report(service: Service, checks: Checks) -> Value {
    match service {
        Service::Koala => json!({
            "status": state(checks.koala.ready()),
            "version": koala::PROMPT_VERSION,
            "checks": {
                "model": state(checks.koala.model),
                "rate_limit": state(checks.koala.rate_limit),
            },
        }),
        Service::Manuals => json!({
            "status": state(checks.manuals),
            "checks": {"configuration": state(checks.manuals)},
        }),
        Service::Papers => json!({
            "status": state(checks.papers),
            "checks": {"configuration": state(checks.papers)},
        }),
    }
}

pub(super) fn live_report(checked_at_ms: u64) -> (Value, u16) {
    (
        json!({
            "service": API_NAME,
            "status": "ok",
            "version": API_VERSION,
            "checked_at_ms": checked_at_ms,
            "runtime": {
                "provider": "cloudflare-workers",
                "status": "ok",
            },
        }),
        200,
    )
}

pub(super) fn report(probe: Probe, checks: Checks, checked_at_ms: u64) -> (Value, u16) {
    let ready = checks.ready_count();
    let stats = json!({
        "services": SERVICE_COUNT,
        "ready": ready,
        "unavailable": SERVICE_COUNT - ready,
    });
    match probe {
        Probe::Health(None) => {
            let status = if checks.all_ready() { "ok" } else { "degraded" };
            (
                json!({
                    "service": API_NAME,
                    "status": status,
                    "version": API_VERSION,
                    "checked_at_ms": checked_at_ms,
                    "runtime": {
                        "provider": "cloudflare-workers",
                        "status": "ok",
                    },
                    "stats": stats,
                    "services": {
                        "koala": service_report(Service::Koala, checks),
                        "manuals": service_report(Service::Manuals, checks),
                        "papers": service_report(Service::Papers, checks),
                    },
                }),
                200,
            )
        }
        Probe::Health(Some(service)) => {
            let ready = checks.service_ready(service);
            (
                json!({
                    "api": API_NAME,
                    "service": service.name(),
                    "status": state(ready),
                    "checked_at_ms": checked_at_ms,
                    "details": service_report(service, checks),
                }),
                if ready { 200 } else { 503 },
            )
        }
        Probe::Ready => {
            let ready = checks.all_ready();
            (
                json!({
                    "service": API_NAME,
                    "status": state(ready),
                    "version": API_VERSION,
                    "checked_at_ms": checked_at_ms,
                    "stats": stats,
                    "services": {
                        "koala": state(checks.koala.ready()),
                        "manuals": state(checks.manuals),
                        "papers": state(checks.papers),
                    },
                }),
                if ready { 200 } else { 503 },
            )
        }
        Probe::Live => live_report(checked_at_ms),
    }
}

#[cfg(test)]
mod tests {
    use super::report;
    use crate::routing::health::{Checks, Probe, Service};
    use crate::service::koala;

    fn partially_ready() -> Checks {
        Checks {
            koala: koala::Readiness {
                model: false,
                rate_limit: true,
            },
            manuals: true,
            papers: true,
        }
    }

    #[test]
    fn aggregate_health_remains_available_during_a_partial_outage() {
        let (body, status) = report(Probe::Health(None), partially_ready(), 123);
        assert_eq!(status, 200);
        assert_eq!(body["service"], "notes-api");
        assert_eq!(body["status"], "degraded");
        assert_eq!(body["stats"]["ready"], 2);
        assert_eq!(body["stats"]["unavailable"], 1);
        assert_eq!(body["services"]["koala"]["status"], "unavailable");
        assert_eq!(body["services"]["manuals"]["status"], "ok");
    }

    #[test]
    fn readiness_and_service_health_fail_only_the_affected_contracts() {
        let checks = partially_ready();
        let (ready, ready_status) = report(Probe::Ready, checks, 123);
        assert_eq!(ready_status, 503);
        assert_eq!(ready["status"], "unavailable");

        let (_, koala_status) = report(Probe::Health(Some(Service::Koala)), checks, 123);
        let (_, papers_status) = report(Probe::Health(Some(Service::Papers)), checks, 123);
        assert_eq!(koala_status, 503);
        assert_eq!(papers_status, 200);
    }
}
