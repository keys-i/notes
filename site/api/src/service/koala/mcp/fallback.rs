//! Typed model failures that activate the browser's local answer path

use crate::routing::response::unavailable_error;
use crate::routing::telemetry::metric;
use worker::{Env, Response, Result};

pub(super) fn model_unavailable(
    env: &Env,
    outcome: &'static str,
    model: &str,
    log: &str,
    message: &'static str,
    started: u64,
    origin: Option<&str>,
) -> Result<Response> {
    worker::console_error!("{log}");
    metric(env, outcome, model, false, started);
    unavailable_error(outcome, message, origin)
}
