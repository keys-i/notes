//! Bounded operational metrics and correlatable request logs

use crate::service::koala::PROMPT_VERSION;
use worker::{Date, Env};

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

#[cfg(test)]
mod tests {
    use super::{metric_line, request_log_line};
    use crate::service::koala::PROMPT_VERSION;

    #[test]
    fn metrics_contain_only_bounded_operational_fields() {
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
