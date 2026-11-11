use super::*;

#[test]
fn model_router_reserves_the_deep_model_for_reasoning_or_long_threads() {
    let mut input = request();
    input.messages[0].content = "Define momentum".into();
    assert_eq!(select_model(&input), ModelRoute::Fast);
    input.messages[0].content = "How should I plan a study break?".into();
    assert_eq!(select_model(&input), ModelRoute::Quick);
    input.messages[0].content = "Compare several ways to revise a new subject step by step".into();
    assert_eq!(select_model(&input), ModelRoute::Deep);
    input.messages[0].content = "Derive the momentum balance step by step".into();
    assert_eq!(select_model(&input), ModelRoute::Deep);
}

#[test]
fn attachment_router_uses_dedicated_models_and_reply_modes() {
    let mut image = request();
    image.attachment = Some(png_attachment());
    assert_eq!(select_model(&image), ModelRoute::Image);
    assert_eq!(reply_mode(&image), ReplyMode::Image);

    let mut audio = request();
    audio.attachment = Some(wav_attachment());
    assert_eq!(select_model(&audio), ModelRoute::Audio);
    assert_eq!(reply_mode(&audio), ReplyMode::Audio);

    assert_eq!(reply_mode(&request()), ReplyMode::Text);
}

#[test]
fn transcribed_questions_route_by_their_content_not_the_media_wrapper() {
    let mut general = request();
    general.messages[0].content = audio_question(
        "Please explain this recording",
        "What makes a useful study break?",
    );
    assert_eq!(select_model(&general), ModelRoute::Quick);

    let mut note = request();
    note.messages[0].content = audio_question("Please explain this recording", "Define momentum");
    assert_eq!(select_model(&note), ModelRoute::Fast);
}

#[test]
fn note_questions_stay_grounded_while_general_questions_remain_conversational() {
    let mut input = request();
    assert_eq!(answer_kind(&input), ReplyKind::Note);
    input.messages[0].content = "What makes a useful study break?".into();
    assert_eq!(answer_kind(&input), ReplyKind::General);
    input.messages[0].content = "Explain this section".into();
    assert_eq!(answer_kind(&input), ReplyKind::Note);
    input.messages[0].content = "According to this note, name the stored fields".into();
    assert_eq!(answer_kind(&input), ReplyKind::Note);
    input.messages[0].content = "Is this noteworthy?".into();
    assert_eq!(answer_kind(&input), ReplyKind::General);
    input.messages[0].content = "Is the noteworthy result aboveboard?".into();
    assert_eq!(answer_kind(&input), ReplyKind::General);
    input.messages = vec![
        Message {
            role: Role::User,
            content: "Why does momentum change?".into(),
        },
        Message {
            role: Role::Assistant,
            content: "Force changes momentum.".into(),
        },
        Message {
            role: Role::User,
            content: "Can you put that more simply?".into(),
        },
    ];
    assert_eq!(answer_kind(&input), ReplyKind::Note);
    input.messages.push(Message {
        role: Role::Assistant,
        content: "Force changes momentum.\n\nSources: Newton's second law".into(),
    });
    input.messages.push(Message {
        role: Role::User,
        content: "What makes a useful study break?".into(),
    });
    assert_eq!(answer_kind(&input), ReplyKind::General);
}
