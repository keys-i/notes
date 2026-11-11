//! Koala request input, attachments, output validation and response caching

mod cache;
mod file;
mod input;
mod output;

pub use cache::cache_key;
pub use input::*;
pub use output::{cited_headings, clean_answer, grounded_answer, guard_allows};

pub(super) use cache::{cache_response, exact_cache_key};
pub(super) use file::{attachment_audio_format, attachment_payload, decode_base64};
pub(super) use input::{MAX_TRANSCRIPT_CHARS, latest_question, validation_code};
pub(super) use output::clean_bounded;
