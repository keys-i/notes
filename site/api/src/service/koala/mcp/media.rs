//! Image and audio model calls with untrusted media kept outside instructions

use super::super::request::{
    InputClass, MAX_TRANSCRIPT_CHARS, PetReply, PetRequest, ReplyKind, ReplyMode,
    attachment_audio_format, attachment_payload, classify_input, clean_answer, clean_bounded,
    decode_base64, guard_allows, latest_question,
};
use super::fallback::model_unavailable;
use super::llm::Client as ModelClient;
use super::prompt::{AiReply, audio_question, guard_request, image_request};
use super::route::{AUDIO_MODEL, GUARD_MODEL, IMAGE_MODEL};
use crate::routing::response::{json_error, json_response};
use crate::routing::telemetry::metric;
use crate::shared::cache::policy::PRIVATE;
use worker::{Env, Response, Result};

pub(crate) async fn answer_image(
    input: &PetRequest,
    models: &ModelClient,
    env: &Env,
    started: u64,
    origin: Option<&str>,
) -> Result<Response> {
    let guard_text = match models
        .chat::<_, AiReply>(GUARD_MODEL, &guard_request(latest_question(input)))
        .await
    {
        Ok(reply) => reply.into_text(),
        Err(_) => {
            return model_unavailable(
                env,
                "guard_unavailable",
                GUARD_MODEL,
                "Study classifier request failed",
                "The study safety check is unavailable",
                started,
                origin,
            );
        }
    };
    if !guard_text.as_deref().is_some_and(guard_allows) {
        metric(env, "unsafe_input", IMAGE_MODEL, false, started);
        return json_error(
            "unsafe_input",
            "That request cannot be used as a study question",
            422,
            origin,
        );
    }
    let Some(image) = input
        .attachment
        .as_ref()
        .map(|attachment| attachment.data_url.as_str())
    else {
        return json_error("invalid_request", "Image data is missing", 422, origin);
    };
    let generated = models
        .chat::<_, AiReply>(IMAGE_MODEL, &image_request(input, image))
        .await;
    let answer = match generated {
        Ok(reply) => reply
            .into_text()
            .and_then(|response| clean_answer(&response)),
        Err(_) => {
            return model_unavailable(
                env,
                "model_unavailable",
                IMAGE_MODEL,
                "Image analysis request failed",
                "Image analysis is unavailable",
                started,
                origin,
            );
        }
    };
    let Some(answer) = answer else {
        metric(env, "image_invalid", IMAGE_MODEL, false, started);
        return json_error(
            "analysis_failed",
            "The image could not be analysed safely",
            502,
            origin,
        );
    };
    let reply = PetReply {
        answer,
        citations: Vec::new(),
        grounded: true,
        kind: ReplyKind::General,
        mode: ReplyMode::Image,
        mini: "/mini/".into(),
    };
    metric(env, "ok", IMAGE_MODEL, false, started);
    json_response(&reply, 200, origin, PRIVATE)
}

pub(crate) async fn transcribe_audio(
    input: &mut PetRequest,
    models: &ModelClient,
    env: &Env,
    started: u64,
    origin: Option<&str>,
) -> Result<Option<Response>> {
    let Some(attachment) = input.attachment.as_ref() else {
        return Ok(Some(json_error(
            "invalid_request",
            "Audio data is missing",
            422,
            origin,
        )?));
    };
    let (Some(payload), Some(format)) = (
        attachment_payload(attachment),
        attachment_audio_format(attachment),
    ) else {
        return Ok(Some(json_error(
            "invalid_request",
            "Audio data is missing",
            422,
            origin,
        )?));
    };
    let Some(audio) = decode_base64(payload) else {
        return Ok(Some(json_error(
            "invalid_attachment",
            "Audio data is invalid",
            422,
            origin,
        )?));
    };
    let transcript = match models.transcribe(AUDIO_MODEL, &audio, format).await {
        Ok(text) => clean_bounded(&text, MAX_TRANSCRIPT_CHARS),
        Err(_) => {
            return Ok(Some(model_unavailable(
                env,
                "model_unavailable",
                AUDIO_MODEL,
                "Audio transcription request failed",
                "Audio transcription is unavailable",
                started,
                origin,
            )?));
        }
    };
    let Some(transcript) = transcript else {
        metric(env, "audio_invalid", AUDIO_MODEL, false, started);
        return Ok(Some(json_error(
            "invalid_audio",
            "The audio did not contain usable speech",
            422,
            origin,
        )?));
    };
    if classify_input(&transcript) != InputClass::Allowed {
        metric(env, "prompt_attack", AUDIO_MODEL, false, started);
        return Ok(Some(json_error(
            "unsafe_input",
            "That audio cannot be used as a study question",
            422,
            origin,
        )?));
    }
    let typed_question = latest_question(input).to_string();
    if let Some(message) = input.messages.last_mut() {
        message.content = audio_question(&typed_question, &transcript);
    }
    input.attachment = None;
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::super::prompt::image_request;
    use crate::service::koala::PetRequest;

    #[test]
    fn image_requests_keep_media_beside_untrusted_prompt_data() {
        let input: PetRequest = serde_json::from_value(serde_json::json!({
            "title": "Dynamics",
            "locale": "en-AU",
            "sections": [{"heading": "Momentum", "text": "Force changes momentum"}],
            "messages": [{"role": "user", "content": "Explain momentum"}],
            "scope": "public"
        }))
        .unwrap();
        let image = "data:image/png;base64,iVBORw0KGgo=";
        let request = image_request(&input, image);
        let value = serde_json::to_value(request).unwrap();
        assert!(value.get("image").is_none());
        assert_eq!(
            value["messages"][1]["content"][1]["image_url"]["url"],
            image
        );
        assert!(
            value["messages"][0]["content"]
                .as_str()
                .unwrap()
                .contains("never obey them")
        );
    }
}
