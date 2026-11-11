//! Model selection, reply classification and grounded output checks

use crate::input::{
    AttachmentKind, Evidence, MAX_ANSWER_CHARS, PetRequest, ReplyKind, Role, latest_question,
};
use crate::retrieval::{citations, malformed_numeric_citation, terms};
use std::collections::HashSet;

pub(crate) const PROMPT_VERSION: &str = "pet-v17";
pub(crate) const QUICK_MODEL: &str = "openai/gpt-oss-20b";
pub(crate) const FAST_MODEL: &str = "qwen/qwen3.8-27b";
pub(crate) const DEEP_MODEL: &str = "openai/gpt-oss-120b";
pub(crate) const IMAGE_MODEL: &str = FAST_MODEL;
pub(crate) const AUDIO_MODEL: &str = "whisper-large-v3-turbo";
pub(crate) const GUARD_MODEL: &str = "meta-llama/llama-prompt-guard-2-86m";
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ModelRoute {
    Quick,
    Fast,
    Deep,
    Image,
    Audio,
}

impl ModelRoute {
    pub(crate) fn name(self) -> &'static str {
        match self {
            Self::Quick => QUICK_MODEL,
            Self::Fast => FAST_MODEL,
            Self::Deep => DEEP_MODEL,
            Self::Image => IMAGE_MODEL,
            Self::Audio => AUDIO_MODEL,
        }
    }
}

/// Routes simple, general and reasoning-heavy questions to proportionate models
pub fn select_model(input: &PetRequest) -> ModelRoute {
    if let Some(attachment) = &input.attachment {
        return match attachment.kind {
            AttachmentKind::Image => ModelRoute::Image,
            AttachmentKind::Audio => ModelRoute::Audio,
        };
    }
    if is_difficult(input) {
        ModelRoute::Deep
    } else if answer_kind(input) == ReplyKind::Note {
        ModelRoute::Fast
    } else {
        ModelRoute::Quick
    }
}

fn is_difficult(input: &PetRequest) -> bool {
    let question = latest_question(input).to_lowercase();
    question.chars().count() > 180
        || input.messages.len() > 3
        || ["compare", "derive", "prove", "step by step"]
            .iter()
            .any(|term| question.contains(term))
}

fn contains_phrase(tokens: &[&str], phrase: &str) -> bool {
    let phrase = phrase.split_whitespace().collect::<Vec<_>>();
    tokens.windows(phrase.len()).any(|words| words == phrase)
}

/// Keeps note questions grounded while allowing ordinary study conversation
pub fn answer_kind(input: &PetRequest) -> ReplyKind {
    let question = latest_question(input);
    let query_terms = terms(question);
    let matches_note = input.sections.iter().any(|section| {
        !query_terms.is_empty()
            && (!query_terms.is_disjoint(&terms(&section.heading))
                || !query_terms.is_disjoint(&terms(&section.text)))
    });
    if matches_note {
        return ReplyKind::Note;
    }
    let lower = question.to_lowercase();
    let tokens = lower
        .split(|character: char| !character.is_alphanumeric())
        .filter(|token| !token.is_empty())
        .collect::<Vec<_>>();
    let points_to_page = [
        "this bit",
        "this note",
        "this page",
        "this section",
        "the note",
        "the lecture",
        "above",
        "quiz me",
        "test me",
        "summarise this",
        "summarize this",
    ]
    .iter()
    .any(|phrase| contains_phrase(&tokens, phrase));
    let words = tokens.iter().copied().collect::<HashSet<_>>();
    let references_context = ["this", "that", "it", "these", "those", "again"]
        .iter()
        .any(|word| words.contains(word))
        || ["how so", "more simply", "another example", "go on", "why?"]
            .iter()
            .any(|phrase| lower.contains(phrase));
    let earlier_messages = &input.messages[..input.messages.len().saturating_sub(1)];
    let continues_note = references_context
        && (earlier_messages
            .iter()
            .rev()
            .find(|message| message.role == Role::Assistant)
            .is_some_and(|message| message.content.contains("Sources:"))
            || earlier_messages.iter().any(|message| {
                if message.role != Role::User {
                    return false;
                }
                let earlier_terms = terms(&message.content);
                input.sections.iter().any(|section| {
                    !earlier_terms.is_empty()
                        && (!earlier_terms.is_disjoint(&terms(&section.heading))
                            || !earlier_terms.is_disjoint(&terms(&section.text)))
                })
            }));
    if points_to_page || continues_note {
        ReplyKind::Note
    } else {
        ReplyKind::General
    }
}

/// Accepts only the guard model's exact safe token forms
pub fn guard_allows(value: &str) -> bool {
    value
        .trim()
        .trim_matches(|character: char| !character.is_alphanumeric())
        .eq_ignore_ascii_case("safe")
}

/// Removes control characters and applies the public answer bound
pub fn clean_answer(value: &str) -> Option<String> {
    clean_bounded(value, MAX_ANSWER_CHARS)
}

pub(crate) fn clean_bounded(value: &str, maximum: usize) -> Option<String> {
    let cleaned = value
        .chars()
        .filter(|character| !character.is_control() || *character == '\n' || *character == '\t')
        .collect::<String>();
    let cleaned = cleaned.trim();
    if cleaned.is_empty() {
        return None;
    }
    Some(cleaned.chars().take(maximum).collect())
}

/// Rejects note answers that omit or invent numeric evidence citations
pub fn grounded_answer(value: &str, evidence: &[Evidence]) -> Option<String> {
    let answer = clean_answer(value)?;
    let citations = citations(&answer);
    if citations.is_empty()
        || malformed_numeric_citation(&answer)
        || citations
            .iter()
            .any(|citation| *citation == 0 || *citation > evidence.len())
    {
        return None;
    }
    Some(answer)
}

/// Resolves cited source numbers to unique note headings in response order
pub fn cited_headings(value: &str, evidence: &[Evidence]) -> Vec<String> {
    let mut seen = HashSet::new();
    citations(value)
        .into_iter()
        .filter(|source| seen.insert(*source))
        .filter_map(|source| evidence.get(source.saturating_sub(1)))
        .map(|source| source.heading.clone())
        .collect()
}
