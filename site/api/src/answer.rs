//! Grounded answer orchestration and model fallback handling

use crate::cache::{cache_response, cached_json, exact_cache_key, short_hash};
use crate::input::{
    InputClass, PetReply, PetRequest, ReplyKind, ReplyMode, authorize_scope, classify_input,
    latest_question, reply_mode, shared_cacheable,
};
use crate::media::{answer_image, transcribe_audio};
use crate::model::Client as ModelClient;
use crate::ops::{json_error, json_response, metric, unavailable_error};
use crate::prompt::{AiReply, generation_request, guard_request};
use crate::retrieval::retrieve;
use crate::study::{
    GUARD_MODEL, answer_kind, cited_headings, clean_answer, grounded_answer, guard_allows,
    select_model,
};
use worker::{Cache, Context, Env, Response, Result};

pub(crate) async fn answer(
    mut input: PetRequest,
    client: String,
    env: Env,
    context: Context,
    started: u64,
    origin: Option<String>,
) -> Result<Response> {
    let principal = match authorize_scope(input.scope) {
        Ok(principal) => principal,
        Err(_) => {
            metric(&env, "access_denied", "none", false, started);
            return json_error(
                "identity_required",
                "Minis questions require a verified Minis session",
                403,
                origin.as_deref(),
            );
        }
    };
    if classify_input(latest_question(&input)) != InputClass::Allowed {
        metric(&env, "prompt_attack", "none", false, started);
        return json_error(
            "unsafe_input",
            "That request cannot be used as a study question",
            422,
            origin.as_deref(),
        );
    }

    let initial_route = select_model(&input);
    let mode = reply_mode(&input);
    let cache = Cache::default();
    let shared_cache = shared_cacheable(&input);
    if shared_cache {
        let exact_key = exact_cache_key(&input, principal);
        match cached_json::<PetReply>(&cache, &exact_key).await {
            Ok(Some(reply)) => {
                metric(&env, "ok", initial_route.name(), true, started);
                return json_response(&reply, 200, origin.as_deref(), "private, no-store");
            }
            Ok(None) => {}
            Err(_) => worker::console_error!("Study cache read failed"),
        }
    }

    let limiter = match env.rate_limiter("PET_LIMIT") {
        Ok(limiter) => limiter,
        Err(_) => {
            metric(
                &env,
                "limiter_unavailable",
                initial_route.name(),
                false,
                started,
            );
            return unavailable_error(
                "service_unavailable",
                "The study request limit is unavailable",
                origin.as_deref(),
            );
        }
    };
    let allowed = match limiter.limit(short_hash(client.as_bytes())).await {
        Ok(outcome) => outcome.success,
        Err(_) => {
            metric(
                &env,
                "limiter_unavailable",
                initial_route.name(),
                false,
                started,
            );
            return unavailable_error(
                "service_unavailable",
                "The study request limit is unavailable",
                origin.as_deref(),
            );
        }
    };
    if !allowed {
        metric(&env, "rate_limited", initial_route.name(), false, started);
        let mut response = json_error(
            "rate_limited",
            "Koa needs a short breather before another new question",
            429,
            origin.as_deref(),
        )?;
        response.headers_mut().set("Retry-After", "60")?;
        return Ok(response);
    }

    let models = match ModelClient::from_env(&env) {
        Ok(models) => models,
        Err(_) => {
            metric(
                &env,
                "backend_unconfigured",
                initial_route.name(),
                false,
                started,
            );
            return unavailable_error(
                "model_unavailable",
                "The study model backend is unavailable",
                origin.as_deref(),
            );
        }
    };

    if mode == ReplyMode::Image {
        return answer_image(&input, &models, &env, started, origin.as_deref()).await;
    }
    if mode == ReplyMode::Audio
        && let Some(response) =
            transcribe_audio(&mut input, &models, &env, started, origin.as_deref()).await?
    {
        return Ok(response);
    }

    let route = select_model(&input);
    let reply_kind = answer_kind(&input);
    match models
        .chat::<_, AiReply>(GUARD_MODEL, &guard_request(latest_question(&input)))
        .await
    {
        Ok(reply) if reply.text().is_some_and(guard_allows) => {}
        Ok(_) => {
            metric(&env, "unsafe_input", route.name(), false, started);
            return json_error(
                "unsafe_input",
                "That request cannot be used as a study question",
                422,
                origin.as_deref(),
            );
        }
        Err(_) => {
            worker::console_error!("Study classifier request failed");
            metric(&env, "guard_unavailable", route.name(), false, started);
            return unavailable_error(
                "model_unavailable",
                "The study safety check is unavailable",
                origin.as_deref(),
            );
        }
    }
    let evidence = if reply_kind == ReplyKind::Note {
        retrieve(&input)
    } else {
        Vec::new()
    };
    if evidence.is_empty() && reply_kind == ReplyKind::Note {
        metric(&env, "no_evidence", route.name(), false, started);
        return json_error(
            "no_evidence",
            "No note evidence was available for that question",
            422,
            origin.as_deref(),
        );
    }
    let generation = generation_request(&input, &evidence, reply_kind);
    let generated = match models.chat::<_, AiReply>(route.name(), &generation).await {
        Ok(reply) => reply.into_text(),
        Err(_) => {
            worker::console_error!("Study answer request failed");
            metric(&env, "model_unavailable", route.name(), false, started);
            return unavailable_error(
                "model_unavailable",
                "The study model is unavailable",
                origin.as_deref(),
            );
        }
    };
    let answer = match reply_kind {
        ReplyKind::Note => generated
            .as_deref()
            .and_then(|response| grounded_answer(response, &evidence)),
        ReplyKind::General => generated.as_deref().and_then(clean_answer),
    };
    let Some(answer) = answer else {
        metric(&env, "grounding_failed", route.name(), false, started);
        return json_error(
            "grounding_failed",
            "The study model could not ground its answer in this note",
            502,
            origin.as_deref(),
        );
    };

    let reply = PetReply {
        citations: if reply_kind == ReplyKind::Note {
            cited_headings(&answer, &evidence)
        } else {
            Vec::new()
        },
        answer,
        grounded: reply_kind == ReplyKind::Note,
        kind: reply_kind,
        mode,
        mini: "/mini/".into(),
    };
    if shared_cache {
        let cached_reply = reply.clone();
        let exact_key = exact_cache_key(&input, principal);
        context.wait_until(async move {
            let cache = Cache::default();
            if let Ok(response) = cache_response(&cached_reply)
                && let Err(error) = cache.put(exact_key, response).await
            {
                worker::console_error!("Exact pet cache write failed: {error}");
            }
        });
    }
    metric(&env, "ok", route.name(), false, started);
    json_response(&reply, 200, origin.as_deref(), "private, no-store")
}
