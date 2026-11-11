//! Model selection and note-versus-general reply classification

use super::super::request::{AttachmentKind, PetRequest, ReplyKind, Role, latest_question};
use super::rank::terms;
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

#[cfg(test)]
mod tests {
    use super::ModelRoute;

    #[test]
    fn model_routes_use_the_owned_free_tier_identifiers() {
        assert_eq!(ModelRoute::Quick.name(), "openai/gpt-oss-20b");
        assert_eq!(ModelRoute::Fast.name(), "qwen/qwen3.8-27b");
        assert_eq!(ModelRoute::Deep.name(), "openai/gpt-oss-120b");
        assert_eq!(ModelRoute::Image.name(), "qwen/qwen3.8-27b");
        assert_eq!(ModelRoute::Audio.name(), "whisper-large-v3-turbo");
    }
}
