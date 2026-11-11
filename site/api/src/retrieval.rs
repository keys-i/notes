//! Deterministic local BM25 retrieval and citation parsing

use crate::input::{Evidence, PetRequest, Section, latest_question};
use std::cmp::Ordering;
use std::collections::HashSet;

const MAX_EVIDENCE_CHARS: usize = 1_800;

/// Returns a small deterministic set of note sections ranked for the latest question
pub fn retrieve(input: &PetRequest) -> Vec<Evidence> {
    let indices = ranked_indices(&bm25_scores(latest_question(input), &input.sections));
    indices
        .iter()
        .take(3)
        .enumerate()
        .filter_map(|(source, index)| {
            input.sections.get(*index).map(|section| Evidence {
                heading: section.heading.clone(),
                source: source + 1,
                text: section.text.chars().take(MAX_EVIDENCE_CHARS).collect(),
            })
        })
        .collect()
}

pub(crate) fn terms(value: &str) -> HashSet<String> {
    tokens(value).into_iter().collect()
}

fn tokens(value: &str) -> Vec<String> {
    value
        .to_lowercase()
        .split(|character: char| !character.is_alphanumeric())
        .filter(|term| term.chars().count() > 2)
        .filter(|term| {
            ![
                "and", "are", "for", "how", "that", "the", "this", "what", "when", "where",
                "which", "why", "with",
            ]
            .contains(term)
        })
        .map(str::to_string)
        .collect()
}

fn bm25_scores(query: &str, sections: &[Section]) -> Vec<f32> {
    if sections.is_empty() {
        return Vec::new();
    }
    let query = terms(query);
    let documents = sections
        .iter()
        .map(|section| tokens(&format!("{} {}", section.heading, section.text)))
        .collect::<Vec<_>>();
    let average_length =
        documents.iter().map(Vec::len).sum::<usize>() as f32 / documents.len().max(1) as f32;
    let count = documents.len() as f32;
    documents
        .iter()
        .map(|document| {
            query
                .iter()
                .map(|term| {
                    let frequency = document.iter().filter(|token| *token == term).count() as f32;
                    if frequency == 0.0 {
                        return 0.0;
                    }
                    let containing = documents
                        .iter()
                        .filter(|candidate| candidate.iter().any(|token| token == term))
                        .count() as f32;
                    let inverse = (1.0 + (count - containing + 0.5) / (containing + 0.5)).ln();
                    let normalised = frequency
                        + 1.2 * (0.25 + 0.75 * document.len() as f32 / average_length.max(1.0));
                    inverse * frequency * 2.2 / normalised
                })
                .sum()
        })
        .collect()
}

fn ranked_indices(scores: &[f32]) -> Vec<usize> {
    let mut ranked = scores.iter().copied().enumerate().collect::<Vec<_>>();
    ranked.sort_by(|left, right| {
        right
            .1
            .partial_cmp(&left.1)
            .unwrap_or(Ordering::Equal)
            .then_with(|| left.0.cmp(&right.0))
    });
    ranked.into_iter().map(|(index, _)| index).collect()
}

pub(crate) fn citations(value: &str) -> Vec<usize> {
    let bytes = value.as_bytes();
    let mut output = Vec::new();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] != b'[' {
            index += 1;
            continue;
        }
        let start = index + 1;
        let mut end = start;
        while end < bytes.len() && bytes[end].is_ascii_digit() {
            end += 1;
        }
        if end > start && bytes.get(end) == Some(&b']') {
            if let Ok(number) = value[start..end].parse() {
                output.push(number);
            }
            index = end + 1;
        } else {
            index += 1;
        }
    }
    output
}

pub(crate) fn malformed_numeric_citation(value: &str) -> bool {
    let bytes = value.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] != b'[' || !bytes.get(index + 1).is_some_and(u8::is_ascii_digit) {
            index += 1;
            continue;
        }
        index += 2;
        while bytes.get(index).is_some_and(u8::is_ascii_digit) {
            index += 1;
        }
        if bytes.get(index) != Some(&b']') {
            return true;
        }
        index += 1;
    }
    false
}
