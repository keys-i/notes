//! Cleaning, safety parsing and citation checks for model output

use super::input::{Evidence, MAX_ANSWER_CHARS};
use std::collections::HashSet;

fn citations(value: &str) -> Vec<usize> {
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

fn malformed_numeric_citation(value: &str) -> bool {
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

/// Accepts only the guard model's exact safe token forms
pub fn guard_allows(value: &str) -> bool {
    value
        .trim()
        .trim_matches(|character: char| !character.is_alphanumeric())
        .eq_ignore_ascii_case("safe")
}

/// Removes control characters and applies the public answer bound
pub fn clean_answer(value: &str) -> Option<String> {
    clean_bounded(value, MAX_ANSWER_CHARS)
}

pub(crate) fn clean_bounded(value: &str, maximum: usize) -> Option<String> {
    let cleaned = value
        .chars()
        .filter(|character| !character.is_control() || *character == '\n' || *character == '\t')
        .collect::<String>();
    let cleaned = cleaned.trim();
    if cleaned.is_empty() {
        return None;
    }
    Some(cleaned.chars().take(maximum).collect())
}

/// Rejects note answers that omit or invent numeric evidence citations
pub fn grounded_answer(value: &str, evidence: &[Evidence]) -> Option<String> {
    let answer = clean_answer(value)?;
    let citations = citations(&answer);
    if citations.is_empty()
        || malformed_numeric_citation(&answer)
        || citations
            .iter()
            .any(|citation| *citation == 0 || *citation > evidence.len())
    {
        return None;
    }
    Some(answer)
}

/// Resolves cited source numbers to unique note headings in response order
pub fn cited_headings(value: &str, evidence: &[Evidence]) -> Vec<String> {
    let mut seen = HashSet::new();
    citations(value)
        .into_iter()
        .filter(|source| seen.insert(*source))
        .filter_map(|source| evidence.get(source.saturating_sub(1)))
        .map(|source| source.heading.clone())
        .collect()
}
