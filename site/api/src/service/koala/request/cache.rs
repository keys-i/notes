//! Stable cache keys and short-lived Worker cache access

use super::super::mcp::{
    AUDIO_MODEL, DEEP_MODEL, FAST_MODEL, GENERAL_TASK_PROMPT, GUARD_MODEL, GUARD_SYSTEM_PROMPT,
    IMAGE_MODEL, IMAGE_SYSTEM_PROMPT, NOTE_TASK_PROMPT, PROMPT_VERSION, QUICK_MODEL,
    STUDY_SYSTEM_PROMPT, answer_kind, select_model,
};
use super::input::{PetRequest, ReplyKind};
use crate::routing::response::json_response;
use crate::shared::cache::{hex, policy::SHARED_REPLY, short_hash};
use serde::Serialize;
use sha2::{Digest, Sha256};
use worker::{Response, Result};

/// Builds the opaque public cache key for a validated request
pub fn cache_key(input: &PetRequest) -> String {
    exact_cache_key(input, "public")
}

pub(crate) fn exact_cache_key(input: &PetRequest, principal: &str) -> String {
    let body = serde_json::to_vec(input).unwrap_or_default();
    let mut hash = Sha256::new();
    hash_pipeline(&mut hash, input);
    hash.update(short_hash(principal.as_bytes()));
    hash.update(b"\0");
    hash.update(body);
    format!(
        "https://pet-cache.invalid/{PROMPT_VERSION}/exact/{}",
        hex(&hash.finalize())
    )
}

fn hash_pipeline(hash: &mut Sha256, input: &PetRequest) {
    for component in [
        PROMPT_VERSION,
        GUARD_MODEL,
        QUICK_MODEL,
        FAST_MODEL,
        DEEP_MODEL,
        IMAGE_MODEL,
        AUDIO_MODEL,
        select_model(input).name(),
        STUDY_SYSTEM_PROMPT,
        IMAGE_SYSTEM_PROMPT,
        GUARD_SYSTEM_PROMPT,
        NOTE_TASK_PROMPT,
        GENERAL_TASK_PROMPT,
    ] {
        hash.update(component.as_bytes());
        hash.update(b"\0");
    }
    hash.update(match answer_kind(input) {
        ReplyKind::Note => "note",
        ReplyKind::General => "general",
    });
    hash.update(b"\0");
}

pub(crate) fn cache_response<T: Serialize>(body: &T) -> Result<Response> {
    json_response(body, 200, None, SHARED_REPLY)
}
