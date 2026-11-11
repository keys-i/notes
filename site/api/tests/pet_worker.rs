use notes_pet::{
    Attachment, AttachmentKind, InputClass, Message, ModelRoute, PetRequest, ReplyKind, ReplyMode,
    Role, Scope, Section, answer_kind, audio_question, authorize_scope, cache_key, cited_headings,
    classify_input, clean_answer, grounded_answer, guard_allows, image_prompt, model_prompt,
    reply_mode, retrieve, select_model, shared_cacheable, validate,
};

fn request() -> PetRequest {
    PetRequest {
        title: "Dynamics".into(),
        locale: "en-AU".into(),
        sections: vec![
            Section {
                heading: "Energy".into(),
                text: "Work changes kinetic energy.".into(),
            },
            Section {
                heading: "Newton's second law".into(),
                text: "Force equals the rate of change of momentum.".into(),
            },
            Section {
                heading: "Impulse".into(),
                text: "Impulse is the integral of force over time and changes momentum.".into(),
            },
        ],
        messages: vec![Message {
            role: Role::User,
            content: "Why does momentum change?".into(),
        }],
        attachment: None,
        scope: Scope::Public,
    }
}

fn png_attachment() -> Attachment {
    Attachment {
        kind: AttachmentKind::Image,
        data_url: "data:image/png;base64,iVBORw0KGgo=".into(),
    }
}

fn wav_attachment() -> Attachment {
    Attachment {
        kind: AttachmentKind::Audio,
        data_url: "data:audio/wav;base64,UklGRgAAAABXQVZF".into(),
    }
}

fn audio_attachment(mime: &str, payload: &str) -> Attachment {
    Attachment {
        kind: AttachmentKind::Audio,
        data_url: format!("data:{mime};base64,{payload}"),
    }
}

#[path = "pet_worker/answer.rs"]
mod answer;
#[path = "pet_worker/cache.rs"]
mod cache;
#[path = "pet_worker/input.rs"]
mod input;
#[path = "pet_worker/prompt.rs"]
mod prompt;
#[path = "pet_worker/retrieval.rs"]
mod retrieval;
#[path = "pet_worker/route.rs"]
mod route;
