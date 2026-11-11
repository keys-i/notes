use super::*;

#[test]
fn shared_edge_cache_excludes_followups_and_personal_looking_questions() {
    let mut input = request();
    input.messages[0].content = "Define momentum".into();
    assert!(shared_cacheable(&input));

    input.messages[0].content = "Explain my result".into();
    assert!(!shared_cacheable(&input));

    input.messages[0].content = "Explain result 0412345678".into();
    assert!(!shared_cacheable(&input));

    let mut followup = request();
    followup.messages.extend([
        Message {
            role: Role::Assistant,
            content: "Force changes momentum [1]".into(),
        },
        Message {
            role: Role::User,
            content: "Can you make that simpler?".into(),
        },
    ]);
    assert!(!shared_cacheable(&followup));

    let mut image = request();
    image.messages[0].content = "Explain this image".into();
    image.attachment = Some(png_attachment());
    assert!(!shared_cacheable(&image));

    let mut audio = request();
    audio.messages[0].content = "Answer my voice question".into();
    audio.attachment = Some(wav_attachment());
    assert!(!shared_cacheable(&audio));
}

#[test]
fn exact_cache_keys_are_stable_hashed_and_content_sensitive() {
    let first = request();
    let mut second = request();
    assert_eq!(cache_key(&first), cache_key(&second));
    assert!(!cache_key(&first).contains("momentum"));
    second.messages[0].content = "What is impulse?".into();
    assert_ne!(cache_key(&first), cache_key(&second));
}
