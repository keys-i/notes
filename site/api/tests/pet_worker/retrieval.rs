use super::*;

#[test]
fn local_bm25_retrieval_ranks_and_bounds_note_evidence() {
    let mut input = request();
    input.messages[0].content = "How is impulse the integral of force over time?".into();
    input.sections.extend([
        Section {
            heading: "Mass".into(),
            text: "Mass measures inertia".into(),
        },
        Section {
            heading: "Position".into(),
            text: "Position locates a particle".into(),
        },
    ]);
    let evidence = retrieve(&input);
    assert_eq!(evidence.len(), 3);
    assert_eq!(evidence[0].heading, "Impulse");
    assert_eq!(
        evidence.iter().map(|item| item.source).collect::<Vec<_>>(),
        [1, 2, 3]
    );
}

#[test]
fn local_bm25_retrieval_is_deterministic_without_a_term_match() {
    let mut input = request();
    input.messages[0].content = "Summarise this section".into();
    let first = retrieve(&input);
    let second = retrieve(&input);
    assert_eq!(first, second);
    assert_eq!(
        first
            .iter()
            .map(|item| item.heading.as_str())
            .collect::<Vec<_>>(),
        ["Energy", "Newton's second law", "Impulse"]
    );
}
