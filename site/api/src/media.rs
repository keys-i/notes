//! Image and audio model calls with untrusted media kept outside instructions

use crate::attachment::{attachment_audio_format, attachment_payload, decode_base64};
use crate::input::{
    InputClass, MAX_TRANSCRIPT_CHARS, PetReply, PetRequest, ReplyKind, ReplyMode, classify_input,
    latest_question,
};
use crate::model::Client as ModelClient;
use crate::ops::{json_error, json_response, metric, unavailable_error};
use crate::prompt::{AiReply, ImageRequest, audio_question, guard_request, image_messages};
use crate::study::{
    AUDIO_MODEL, GUARD_MODEL, IMAGE_MODEL, clean_answer, clean_bounded, guard_allows,
};
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
            worker::console_error!("Study classifier request failed");
            metric(env, "guard_unavailable", IMAGE_MODEL, false, started);
            return unavailable_error(
                "model_unavailable",
                "The study safety check is unavailable",
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
        .chat::<_, AiReply>(
            IMAGE_MODEL,
            &ImageRequest {
                messages: image_messages(input, image),
                max_tokens: 900,
                temperature: 0.1,
            },
        )
        .await;
    let answer = match generated {
        Ok(reply) => reply
            .into_text()
            .and_then(|response| clean_answer(&response)),
        Err(_) => {
            worker::console_error!("Image analysis request failed");
            metric(env, "model_unavailable", IMAGE_MODEL, false, started);
            return unavailable_error("model_unavailable", "Image analysis is unavailable", origin);
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
    json_response(&reply, 200, origin, "private, no-store")
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
            worker::console_error!("Audio transcription request failed");
            metric(env, "model_unavailable", AUDIO_MODEL, false, started);
            return Ok(Some(unavailable_error(
                "model_unavailable",
                "Audio transcription is unavailable",
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
