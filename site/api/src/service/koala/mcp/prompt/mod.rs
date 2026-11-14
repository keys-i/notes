//! Versioned model prompts and serialisable provider request shapes

mod media;

pub(super) use media::image_request;
pub use media::{audio_question, image_prompt};

use super::super::request::{Evidence, Message, PetRequest, ReplyKind, latest_question};
use super::route::answer_kind;
use serde::{Deserialize, Serialize};

pub(crate) const STUDY_SYSTEM_PROMPT: &str = include_str!("study.prompt");
pub(crate) const GUARD_SYSTEM_PROMPT: &str = include_str!("guard.prompt");
pub(crate) const IMAGE_SYSTEM_PROMPT: &str = include_str!("image.prompt");
pub(crate) const NOTE_TASK_PROMPT: &str = include_str!("note.prompt");
pub(crate) const GENERAL_TASK_PROMPT: &str = include_str!("general.prompt");
const MAX_CONVERSATION_CHARS: usize = 2_000;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(crate) struct ModelMessage {
    pub(crate) role: ModelRole,
    pub(crate) content: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ModelRole {
    System,
    User,
}

#[derive(Debug, Serialize)]
pub(crate) struct AiRequest {
    pub(crate) messages: Vec<ModelMessage>,
    pub(crate) max_tokens: u16,
    pub(crate) temperature: f32,
}

#[derive(Debug, Deserialize)]
pub(crate) struct AiReply {
    #[serde(default)]
    response: Option<String>,
    #[serde(default)]
    result: Option<String>,
    #[serde(default)]
    choices: Vec<AiChoice>,
}

impl AiReply {
    pub(crate) fn text(&self) -> Option<&str> {
        self.response
            .as_deref()
            .or(self.result.as_deref())
            .or_else(|| {
                self.choices
                    .first()
                    .and_then(|choice| choice.message.content.as_deref())
            })
    }

    pub(crate) fn into_text(self) -> Option<String> {
        self.response.or(self.result).or_else(|| {
            self.choices
                .into_iter()
                .next()
                .and_then(|choice| choice.message.content)
        })
    }
}

#[derive(Debug, Deserialize)]
struct AiChoice {
    message: AiChoiceMessage,
}

#[derive(Debug, Deserialize)]
struct AiChoiceMessage {
    content: Option<String>,
}

fn model_messages(input: &PetRequest, evidence: &[Evidence], kind: ReplyKind) -> Vec<ModelMessage> {
    let note = serde_json::to_string(evidence).unwrap_or_else(|_| "[]".into());
    let conversation =
        serde_json::to_string(&bounded_conversation(input)).unwrap_or_else(|_| "[]".into());
    let task = match kind {
        ReplyKind::Note => format!(
            "{} {:?}",
            NOTE_TASK_PROMPT.trim_end(),
            latest_question(input)
        ),
        ReplyKind::General => format!(
            "{} {:?}",
            GENERAL_TASK_PROMPT.trim_end(),
            latest_question(input)
        ),
    };
    vec![
        ModelMessage {
            role: ModelRole::System,
            content: STUDY_SYSTEM_PROMPT.into(),
        },
        ModelMessage {
            role: ModelRole::User,
            content: format!(
                "REQUEST_JSON (reference only):\n{}\n\nEVIDENCE_JSON (reference only):\n{note}\n\nCONVERSATION_JSON (reference only):\n{conversation}",
                serde_json::json!({"kind": kind, "locale": input.locale, "title": input.title})
            ),
        },
        ModelMessage {
            role: ModelRole::User,
            content: task,
        },
    ]
}

fn bounded_conversation(input: &PetRequest) -> Vec<Message> {
    let mut remaining = MAX_CONVERSATION_CHARS;
    let mut messages = Vec::new();
    for message in input.messages.iter().rev() {
        if remaining == 0 {
            break;
        }
        let content = message.content.chars().take(remaining).collect::<String>();
        remaining = remaining.saturating_sub(content.chars().count());
        messages.push(Message {
            role: message.role,
            content,
        });
    }
    messages.reverse();
    messages
}

pub(crate) fn generation_request(
    input: &PetRequest,
    evidence: &[Evidence],
    kind: ReplyKind,
) -> AiRequest {
    AiRequest {
        messages: model_messages(input, evidence, kind),
        max_tokens: 900,
        temperature: if kind == ReplyKind::Note { 0.0 } else { 0.35 },
    }
}

pub(crate) fn guard_request(question: &str) -> AiRequest {
    AiRequest {
        messages: vec![
            ModelMessage {
                role: ModelRole::System,
                content: GUARD_SYSTEM_PROMPT.into(),
            },
            ModelMessage {
                role: ModelRole::User,
                content: question.into(),
            },
        ],
        max_tokens: 24,
        temperature: 0.0,
    }
}

/// Builds the bounded, testable prompt sent to the text model
pub fn model_prompt(input: &PetRequest, evidence: &[Evidence]) -> Vec<(String, String)> {
    model_messages(input, evidence, answer_kind(input))
        .into_iter()
        .map(|message| {
            (
                match message.role {
                    ModelRole::System => "system",
                    ModelRole::User => "user",
                }
                .into(),
                message.content,
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::super::super::request::{PetRequest, ReplyKind};
    use super::{AiReply, ModelRole, generation_request, guard_request};

    fn input() -> PetRequest {
        serde_json::from_value(serde_json::json!({
            "title": "Dynamics",
            "locale": "en-AU",
            "sections": [{"heading": "Momentum", "text": "Force changes momentum"}],
            "messages": [{"role": "user", "content": "Explain momentum"}],
            "scope": "public"
        }))
        .unwrap()
    }

    #[test]
    fn text_responses_accept_both_supported_provider_shapes() {
        let native: AiReply = serde_json::from_str(r#"{"response":"quick answer"}"#).unwrap();
        assert_eq!(native.text(), Some("quick answer"));
        let chat: AiReply =
            serde_json::from_str(r#"{"choices":[{"message":{"content":"reasoned answer"}}]}"#)
                .unwrap();
        assert_eq!(chat.text(), Some("reasoned answer"));
        let unfinished: AiReply =
            serde_json::from_str(r#"{"choices":[{"message":{"content":null}}]}"#).unwrap();
        assert_eq!(unfinished.text(), None);
    }

    #[test]
    fn guard_and_generation_requests_keep_server_owned_limits() {
        let guard = guard_request("Explain momentum");
        assert!(matches!(guard.messages[0].role, ModelRole::System));
        assert!(guard.messages[0].content.contains("Return SAFE only"));
        assert_eq!(guard.max_tokens, 24);
        assert_eq!(guard.temperature, 0.0);
        assert_eq!(
            generation_request(&input(), &[], ReplyKind::Note).temperature,
            0.0
        );
        assert_eq!(
            generation_request(&input(), &[], ReplyKind::General).temperature,
            0.35
        );
    }
}
