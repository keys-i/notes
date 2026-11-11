use super::*;

#[test]
fn output_is_bounded_and_cited_to_available_evidence() {
    let evidence = vec![
        notes_pet::Evidence {
            heading: "Momentum".into(),
            source: 1,
            text: "Force changes momentum".into(),
        },
        notes_pet::Evidence {
            heading: "Impulse".into(),
            source: 2,
            text: "Impulse integrates force".into(),
        },
    ];
    assert_eq!(
        clean_answer("  hello\0 there  ").as_deref(),
        Some("hello there")
    );
    assert_eq!(clean_answer("\n\t"), None);
    assert_eq!(
        clean_answer(&"x".repeat(5_000)).unwrap().chars().count(),
        4_500
    );
    assert_eq!(
        grounded_answer("Force changes momentum [1]", &evidence).as_deref(),
        Some("Force changes momentum [1]")
    );
    assert_eq!(grounded_answer("Force changes momentum", &evidence), None);
    assert_eq!(
        grounded_answer("Force changes momentum", &evidence[..1]),
        None
    );
    assert_eq!(
        grounded_answer("Force changes momentum.", &evidence[..1]),
        None
    );
    assert!(grounded_answer("Force changes momentum", &[]).is_none());
    let long_grounded = format!("[1] {}", "x".repeat(5_000));
    assert_eq!(
        grounded_answer(&long_grounded, &evidence)
            .unwrap()
            .chars()
            .count(),
        4_500
    );
    assert_eq!(grounded_answer("Unsupported source [3]", &evidence), None);
    assert_eq!(grounded_answer("Malformed source [1a]", &evidence), None);
    assert_eq!(
        cited_headings(
            "Force changes momentum [1]. Again [1], then impulse [2]",
            &evidence
        ),
        ["Momentum", "Impulse"]
    );
}
