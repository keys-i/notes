//! Validated course catalogue built from the editable TOML source

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::sync::LazyLock;

const SOURCE: &str = include_str!("../../../../config/courses.toml");
const DAY_MS: u64 = 86_400_000;
const MAX_COURSES: usize = 128;
const MAX_RESPONSE_BYTES: usize = 96 * 1024;
const CATALOGUE_URL: &str = "https://learn.uq.edu.au/ultra/catalog";

#[derive(Debug, PartialEq, Eq)]
pub(super) struct ConfigError;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SourceConfig {
    updated: String,
    courses: Vec<SourceCourse>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "kebab-case")]
struct SourceCourse {
    code: String,
    title: String,
    maturity: Maturity,
    route: Option<String>,
    verified: String,
    catalogue_id: Option<String>,
    offering: Option<String>,
    papers_route: Option<String>,
    cheatsheet_route: Option<String>,
    folder_code: Option<String>,
    source_permission: Option<SourcePermission>,
    review: Option<Review>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum Maturity {
    Source,
    Resources,
    Learning,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SourcePermission {
    status: String,
    record: String,
    expires: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Review {
    role: String,
    date: String,
    record: String,
}

#[derive(Debug, Serialize)]
pub(super) struct Catalog {
    updated: String,
    courses: Vec<Course>,
}

#[derive(Debug, Serialize)]
pub(super) struct Course {
    code: String,
    title: String,
    area: String,
    maturity: Maturity,
    #[serde(skip_serializing_if = "Option::is_none")]
    route: Option<String>,
    verified: String,
    stale: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    catalogue_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    catalogue_url: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    catalogue_label: Option<String>,
    source_label: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    offering: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    papers_route: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cheatsheet_route: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_url: Option<String>,
    capabilities: Vec<&'static str>,
}

static CONFIG: LazyLock<Result<SourceConfig, ConfigError>> =
    LazyLock::new(|| toml::from_str(SOURCE).map_err(|_| ConfigError));
static READY: LazyLock<bool> = LazyLock::new(|| {
    let Ok(source) = CONFIG.as_ref() else {
        return false;
    };
    date_ms(&source.updated).is_some_and(|now_ms| build_catalog(source, now_ms).is_ok())
});

pub(super) fn catalog(now_ms: u64) -> Result<Catalog, ConfigError> {
    build_catalog(CONFIG.as_ref().map_err(|_| ConfigError)?, now_ms)
}

pub(super) fn course(code: &str, now_ms: u64) -> Result<Option<Course>, ConfigError> {
    let catalog = catalog(now_ms)?;
    Ok(catalog
        .courses
        .into_iter()
        .find(|course| course.code == code))
}

pub(super) fn ready() -> bool {
    *READY
}

#[cfg(test)]
fn parse_source(source: &str, now_ms: u64) -> Result<Catalog, ConfigError> {
    let source = toml::from_str(source).map_err(|_| ConfigError)?;
    build_catalog(&source, now_ms)
}

fn build_catalog(source: &SourceConfig, now_ms: u64) -> Result<Catalog, ConfigError> {
    if source.courses.is_empty() || source.courses.len() > MAX_COURSES {
        return Err(ConfigError);
    }
    let updated_ms = date_ms(&source.updated).ok_or(ConfigError)?;
    if updated_ms > now_ms {
        return Err(ConfigError);
    }

    let mut codes = BTreeSet::new();
    let mut courses = Vec::with_capacity(source.courses.len());
    for source_course in &source.courses {
        if !codes.insert(source_course.code.as_str()) {
            return Err(ConfigError);
        }
        courses.push(build_course(source_course, now_ms)?);
    }
    courses.sort_by(|left, right| left.code.cmp(&right.code));

    let catalog = Catalog {
        updated: source.updated.clone(),
        courses,
    };
    if serde_json::to_vec(&catalog).map_err(|_| ConfigError)?.len() > MAX_RESPONSE_BYTES {
        return Err(ConfigError);
    }
    Ok(catalog)
}

fn build_course(source: &SourceCourse, now_ms: u64) -> Result<Course, ConfigError> {
    if !course_code(&source.code) || !text(&source.title, 120) {
        return Err(ConfigError);
    }
    let area = course_area(&source.code).ok_or(ConfigError)?;
    let verified_ms = date_ms(&source.verified).ok_or(ConfigError)?;
    if verified_ms > now_ms {
        return Err(ConfigError);
    }

    let course_route = format!("{}/{}/", &source.code[..4], &source.code[4..]);
    let paper_route = format!("{course_route}PY/");
    validate_route(source.route.as_deref(), &course_route)?;
    validate_route(source.papers_route.as_deref(), &paper_route)?;
    validate_cheatsheet(source.cheatsheet_route.as_deref(), &course_route)?;

    let catalogue_id = source
        .catalogue_id
        .as_deref()
        .map(validate_identifier)
        .transpose()?;
    if source
        .offering
        .as_deref()
        .is_some_and(|value| !text(value, 120))
    {
        return Err(ConfigError);
    }
    let folder_url = source.folder_code.as_deref().map(folder_url).transpose()?;
    let source_url = permission_url(
        &source.code,
        folder_url,
        source.source_permission.as_ref(),
        now_ms,
    )?;
    if catalogue_id.is_none() && source_url.is_none() {
        return Err(ConfigError);
    }

    validate_maturity(source, now_ms)?;
    let route = source.route.as_ref().map(|value| format!("/{value}"));
    let papers_route = source
        .papers_route
        .as_ref()
        .map(|value| format!("/{value}"));
    let cheatsheet_route = source
        .cheatsheet_route
        .as_ref()
        .map(|value| format!("/{value}"));
    let mut capabilities = Vec::with_capacity(3);
    if route.is_some() {
        capabilities.push("notes");
    }
    if cheatsheet_route.is_some() {
        capabilities.push("cheatsheet");
    }
    capabilities.push("source");

    Ok(Course {
        code: source.code.clone(),
        title: source.title.clone(),
        area: area.into(),
        maturity: source.maturity,
        route,
        verified: source.verified.clone(),
        stale: now_ms >= verified_ms + 365 * DAY_MS,
        catalogue_id: catalogue_id.map(str::to_owned),
        catalogue_url: catalogue_id.map(|_| CATALOGUE_URL),
        catalogue_label: catalogue_id
            .map(|_| format!("Open the UQ catalogue and search {}", source.code)),
        source_label: if catalogue_id.is_some() {
            "UQ catalogue"
        } else {
            "Course archive"
        },
        offering: source.offering.clone(),
        papers_route,
        cheatsheet_route,
        source_url,
        capabilities,
    })
}

fn validate_maturity(source: &SourceCourse, now_ms: u64) -> Result<(), ConfigError> {
    match source.maturity {
        Maturity::Source => {
            if source.route.is_some()
                || source.papers_route.is_some()
                || source.cheatsheet_route.is_some()
                || source.review.is_some()
            {
                return Err(ConfigError);
            }
        }
        Maturity::Resources => {
            if (source.route.is_none() && source.cheatsheet_route.is_none())
                || source.review.is_some()
            {
                return Err(ConfigError);
            }
        }
        Maturity::Learning => {
            let review = source.review.as_ref().ok_or(ConfigError)?;
            if source.route.is_none()
                || !text(&review.role, 120)
                || review.record != format!("docs/reviews/{}.md", source.code)
            {
                return Err(ConfigError);
            }
            let review_ms = date_ms(&review.date).ok_or(ConfigError)?;
            if review_ms > now_ms || now_ms >= review_ms + 365 * DAY_MS {
                return Err(ConfigError);
            }
        }
    }
    Ok(())
}

fn permission_url(
    code: &str,
    folder_url: Option<String>,
    permission: Option<&SourcePermission>,
    now_ms: u64,
) -> Result<Option<String>, ConfigError> {
    let Some(permission) = permission else {
        return Ok(None);
    };
    if folder_url.is_none()
        || permission.status != "allowed"
        || permission.record != format!("docs/sources/{code}.md")
    {
        return Err(ConfigError);
    }
    let expiry_ms = date_ms(&permission.expires).ok_or(ConfigError)?;
    if now_ms < expiry_ms + DAY_MS {
        Ok(folder_url)
    } else {
        Ok(None)
    }
}

fn validate_route(value: Option<&str>, expected: &str) -> Result<(), ConfigError> {
    if value.is_some_and(|value| value != expected) {
        return Err(ConfigError);
    }
    Ok(())
}

fn validate_cheatsheet(value: Option<&str>, course_route: &str) -> Result<(), ConfigError> {
    if value.is_some_and(|value| {
        value.len() > 240
            || value.len() <= course_route.len()
            || !value.starts_with(course_route)
            || value.contains("..")
            || value.contains("//")
            || value.contains('\\')
            || value.chars().any(char::is_control)
    }) {
        return Err(ConfigError);
    }
    Ok(())
}

fn validate_identifier(value: &str) -> Result<&str, ConfigError> {
    if identifier(value) {
        Ok(value)
    } else {
        Err(ConfigError)
    }
}

fn folder_url(value: &str) -> Result<String, ConfigError> {
    let (folder, resource) = value
        .split_once('?')
        .map_or((value, None), |(folder, query)| {
            (folder, query.strip_prefix("resourcekey="))
        });
    if !identifier(folder) || value.contains('?') && resource.is_none() {
        return Err(ConfigError);
    }
    if resource.is_some_and(|value| !identifier(value)) {
        return Err(ConfigError);
    }
    let mut url = format!("https://drive.google.com/drive/folders/{folder}");
    if let Some(resource) = resource {
        url.push_str("?resourcekey=");
        url.push_str(resource);
    }
    Ok(url)
}

fn identifier(value: &str) -> bool {
    (10..=128).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn course_code(value: &str) -> bool {
    value.len() == 8
        && value.as_bytes()[..4].iter().all(u8::is_ascii_uppercase)
        && value.as_bytes()[4..].iter().all(u8::is_ascii_digit)
}

fn course_area(code: &str) -> Option<&'static str> {
    match &code[..4] {
        "COMP" | "COMS" | "COSC" | "CSSE" => Some("computing"),
        "DECO" | "DSGN" => Some("design"),
        "ENGG" | "MECH" => Some("engineering"),
        "INFS" => Some("information-systems"),
        "MATH" => Some("mathematics"),
        "BIOE" | "BIOL" | "BIOM" | "BIOI" | "CHEM" | "ERTH" | "PHYS" | "SCIE" => Some("science"),
        "CYBR" => Some("security"),
        "STAT" => Some("statistics"),
        _ => None,
    }
}

fn text(value: &str, max: usize) -> bool {
    !value.trim().is_empty() && value.chars().count() <= max && !value.chars().any(char::is_control)
}

fn date_ms(value: &str) -> Option<u64> {
    let bytes = value.as_bytes();
    if bytes.len() != 10
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || bytes
            .iter()
            .enumerate()
            .any(|(index, byte)| index != 4 && index != 7 && !byte.is_ascii_digit())
    {
        return None;
    }
    let year: u16 = value[..4].parse().ok()?;
    let month: u8 = value[5..7].parse().ok()?;
    let day: u8 = value[8..].parse().ok()?;
    if !(1970..=9999).contains(&year) || !(1..=12).contains(&month) {
        return None;
    }
    let month_days = [
        31,
        if leap_year(year) { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    if day == 0 || usize::from(day) > month_days[usize::from(month - 1)] {
        return None;
    }
    let prior_year_days: u64 = (1970..year)
        .map(|year| if leap_year(year) { 366 } else { 365 })
        .sum();
    let prior_month_days: usize = month_days[..usize::from(month - 1)].iter().sum();
    Some((prior_year_days + prior_month_days as u64 + u64::from(day - 1)) * DAY_MS)
}

fn leap_year(year: u16) -> bool {
    year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400))
}

#[cfg(test)]
mod tests {
    use super::{catalog, course, parse_source, ready};
    use serde::Deserialize;

    const NOW_MS: u64 = 1_794_528_000_000;
    const DAY_MS: u64 = 86_400_000;
    const FIXTURES: &str = include_str!("../../../../config/tests/courses.toml");

    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Fixtures {
        cases: Vec<Case>,
    }

    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Case {
        name: String,
        valid: bool,
        source: String,
    }

    fn source_header() -> String {
        "updated = \"2026-11-13\"\n".into()
    }

    fn source_course(index: usize, detailed: bool) -> String {
        let code = format!("COMP{index:04}");
        let route = format!("COMP/{index:04}/");
        if detailed {
            format!(
                "\n[[courses]]\ncode = \"{code}\"\ntitle = \"{}\"\nmaturity = \"resources\"\nroute = \"{route}\"\nverified = \"2026-11-13\"\ncatalogue-id = \"{}\"\noffering = \"{}\"\npapers-route = \"{route}PY/\"\ncheatsheet-route = \"{route}{}.pdf\"\nfolder-code = \"{}\"\n\n[courses.source-permission]\nstatus = \"allowed\"\nrecord = \"docs/sources/{code}.md\"\nexpires = \"2027-11-13\"\n",
                "T".repeat(120),
                "I".repeat(128),
                "O".repeat(120),
                "C".repeat(180),
                "F".repeat(128),
            )
        } else {
            format!(
                "\n[[courses]]\ncode = \"{code}\"\ntitle = \"Course {index}\"\nmaturity = \"source\"\nverified = \"2026-11-13\"\ncatalogue-id = \"COMP_{index:04}_CATALOGUE\"\n"
            )
        }
    }

    #[test]
    fn shared_cases_match_the_declared_result() {
        let fixtures: Fixtures = toml::from_str(FIXTURES).unwrap();
        for case in fixtures.cases {
            assert_eq!(
                parse_source(&case.source, NOW_MS).is_ok(),
                case.valid,
                "{}",
                case.name
            );
        }
    }

    #[test]
    fn responses_derive_actions_and_omit_missing_fields() {
        let fixtures: Fixtures = toml::from_str(FIXTURES).unwrap();
        let response = |name: &str| {
            let case = fixtures
                .cases
                .iter()
                .find(|case| case.name == name)
                .unwrap();
            serde_json::to_value(parse_source(&case.source, NOW_MS).unwrap()).unwrap()
        };

        let source = response("valid-source");
        let source = &source["courses"][0];
        assert_eq!(
            source["catalogue_url"],
            "https://learn.uq.edu.au/ultra/catalog"
        );
        assert_eq!(source["source_label"], "UQ catalogue");
        assert_eq!(source["area"], "computing");
        assert!(source.get("route").is_none());
        assert!(source.get("source_url").is_none());

        let resources = response("valid-resources");
        let resources = &resources["courses"][0];
        assert_eq!(resources["route"], "/COMP/4702/");
        assert_eq!(resources["papers_route"], "/COMP/4702/PY/");
        assert_eq!(
            resources["capabilities"],
            serde_json::json!(["notes", "source"])
        );

        let folder = response("valid-folder-identity");
        let folder = &folder["courses"][0];
        assert_eq!(folder["source_label"], "Course archive");
        assert!(
            folder["source_url"]
                .as_str()
                .unwrap()
                .starts_with("https://drive.google.com/drive/folders/")
        );
        assert!(folder.get("catalogue_url").is_none());
    }

    #[test]
    fn catalogue_orders_codes_and_supports_exact_lookup() {
        let source = r#"
updated = "2026-11-13"

[[courses]]
code = "STAT1201"
title = "Analysis of Scientific Data"
maturity = "source"
verified = "2026-11-13"
catalogue-id = "STAT1201_0000_00002"

[[courses]]
code = "COMP4500"
title = "Advanced Algorithms and Data Structures"
maturity = "source"
verified = "2026-11-13"
catalogue-id = "COMP4500_7660_60785"
"#;
        let value = serde_json::to_value(parse_source(source, NOW_MS).unwrap()).unwrap();
        let courses = value["courses"].as_array().unwrap();
        assert_eq!(courses[0]["code"], "COMP4500");
        assert_eq!(courses[1]["code"], "STAT1201");
        assert_eq!(courses[0]["area"], "computing");
        assert_eq!(courses[1]["area"], "statistics");

        assert!(ready());
        assert_eq!(
            serde_json::to_value(course("COMP4702", NOW_MS).unwrap().unwrap()).unwrap()["code"],
            "COMP4702"
        );
        assert!(course("comp4702", NOW_MS).unwrap().is_none());
        assert_eq!(catalog(NOW_MS).unwrap().courses.len(), 2);
    }

    #[test]
    fn stale_changes_at_exactly_365_days() {
        let source = r#"
updated = "2025-01-01"

[[courses]]
code = "COMP4702"
title = "Machine Learning"
maturity = "source"
verified = "2025-01-01"
catalogue-id = "COMP4702_7620_21208"
"#;
        let verified_ms = 1_735_689_600_000;
        let boundary = verified_ms + 365 * DAY_MS;
        assert!(!parse_source(source, boundary - 1).unwrap().courses[0].stale);
        assert!(parse_source(source, boundary).unwrap().courses[0].stale);
        assert!(parse_source(source, boundary + 1).unwrap().courses[0].stale);
    }

    #[test]
    fn catalogue_has_hard_count_and_response_size_limits() {
        let mut source = source_header();
        for index in 0..128 {
            source.push_str(&source_course(index, false));
        }
        assert_eq!(parse_source(&source, NOW_MS).unwrap().courses.len(), 128);
        source.push_str(&source_course(128, false));
        assert!(parse_source(&source, NOW_MS).is_err());

        let mut oversized = source_header();
        for index in 0..128 {
            oversized.push_str(&source_course(index, true));
        }
        assert!(parse_source(&oversized, NOW_MS).is_err());
    }
}
