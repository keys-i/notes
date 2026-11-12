//! Koala request routing and service boundaries

mod mcp;
mod request;

pub(crate) use mcp::{Client, PROMPT_VERSION, answer};
use request::validation_code;

use crate::routing::response::{json_error, method_error};
use futures_util::StreamExt;
use worker::{Context, Env, Method, Request, Response, Result};

const MAX_BODY_BYTES: usize = 2_900_000;

pub use mcp::{
    ModelRoute, answer_kind, audio_question, image_prompt, model_prompt, retrieve, select_model,
};
pub use request::*;

#[derive(Clone, Copy, Debug)]
pub(crate) struct Readiness {
    pub(crate) model: bool,
    pub(crate) rate_limit: bool,
}

impl Readiness {
    pub(crate) fn ready(self) -> bool {
        self.model && self.rate_limit
    }
}

pub(crate) fn readiness(env: &Env) -> Readiness {
    Readiness {
        model: Client::from_env(env).is_ok(),
        rate_limit: env.rate_limiter("PET_LIMIT").is_ok(),
    }
}

pub(crate) async fn respond(
    mut request: Request,
    env: Env,
    context: Context,
    started: u64,
    origin: Option<String>,
) -> Result<Response> {
    if request.method() != Method::Post {
        return method_error(
            "Use POST for study questions",
            "POST, OPTIONS",
            origin.as_deref(),
        );
    }
    if request
        .headers()
        .get("Content-Type")?
        .as_deref()
        .is_none_or(|value| !value.starts_with("application/json"))
    {
        return json_error(
            "unsupported_media_type",
            "Content-Type must be application/json",
            415,
            origin.as_deref(),
        );
    }
    if request
        .headers()
        .get("Content-Encoding")?
        .as_deref()
        .is_some_and(|value| value != "identity")
    {
        return json_error(
            "unsupported_encoding",
            "Compressed study requests are not accepted",
            415,
            origin.as_deref(),
        );
    }

    let mut body = Vec::new();
    let mut stream = match request.stream() {
        Ok(stream) => stream,
        Err(_) => {
            return json_error(
                "invalid_json",
                "Request body is not valid JSON",
                400,
                origin.as_deref(),
            );
        }
    };
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        if append_bounded(&mut body, &chunk, MAX_BODY_BYTES).is_err() {
            return json_error(
                "request_too_large",
                "Study request is too large",
                413,
                origin.as_deref(),
            );
        }
    }
    let input = match serde_json::from_slice::<PetRequest>(&body) {
        Ok(input) => match validate(input) {
            Ok(input) => input,
            Err(message) => {
                return json_error(validation_code(message), message, 422, origin.as_deref());
            }
        },
        Err(_) => {
            return json_error(
                "invalid_json",
                "Request body is not valid JSON",
                400,
                origin.as_deref(),
            );
        }
    };
    let client = request
        .headers()
        .get("CF-Connecting-IP")?
        .unwrap_or_else(|| "unknown".into());
    answer(input, client, env, context, started, origin).await
}

fn append_bounded(body: &mut Vec<u8>, chunk: &[u8], maximum: usize) -> Result<(), ()> {
    if chunk.len() > maximum.saturating_sub(body.len()) {
        return Err(());
    }
    body.extend_from_slice(chunk);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{append_bounded, validation_code};

    #[test]
    fn body_limit_rejects_a_chunk_before_allocating_it() {
        let mut body = b"1234".to_vec();
        assert_eq!(append_bounded(&mut body, b"56", 5), Err(()));
        assert_eq!(body, b"1234");
    }

    #[test]
    fn validation_errors_keep_stable_public_codes() {
        assert_eq!(validation_code("invalid attachment"), "invalid_attachment");
        assert_eq!(validation_code("invalid title"), "invalid_request");
    }
}
