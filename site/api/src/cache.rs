//! Stable cache keys and short-lived Worker cache access

use crate::input::{PetRequest, ReplyKind};
use crate::ops::json_response;
use crate::prompt::{GUARD_SYSTEM_PROMPT, IMAGE_SYSTEM_PROMPT, STUDY_SYSTEM_PROMPT};
use crate::study::{
    AUDIO_MODEL, DEEP_MODEL, FAST_MODEL, GUARD_MODEL, IMAGE_MODEL, PROMPT_VERSION, QUICK_MODEL,
    answer_kind, select_model,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use worker::{Cache, Response, Result};

const CACHE_TTL: u32 = 86_400;

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

pub(crate) fn short_hash(value: &[u8]) -> String {
    let mut hash = Sha256::new();
    hash.update(value);
    hex(&hash.finalize()[..16])
}

fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(DIGITS[(byte >> 4) as usize] as char);
        output.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    output
}

pub(crate) async fn cached_json<T: for<'de> Deserialize<'de>>(
    cache: &Cache,
    key: &str,
) -> Result<Option<T>> {
    let Some(mut response) = cache.get(key, false).await? else {
        return Ok(None);
    };
    Ok(response.json::<T>().await.ok())
}

pub(crate) fn cache_response<T: Serialize>(body: &T) -> Result<Response> {
    json_response(body, 200, None, &format!("public, max-age={CACHE_TTL}"))
}
