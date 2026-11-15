//! Validated course-material catalogues built from the editable TOML source

use super::config::{course_code, date_ms, text};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::sync::LazyLock;

const SOURCE: &str = include_str!("../../../../config/materials.toml");
const MAX_CATALOGUES: usize = 128;
const MAX_ITEMS: usize = 64;
const MAX_RESPONSE_BYTES: usize = 256 * 1024;

#[derive(Debug, PartialEq, Eq)]
pub(super) struct ConfigError;

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct SourceConfig {
    updated: String,
    catalogues: Vec<SourceCatalogue>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct SourceCatalogue {
    course: String,
    #[serde(rename = "type")]
    kind: MaterialKind,
    route: String,
    source: String,
    items: Vec<Material>,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
enum MaterialKind {
    Prac,
    Lec,
    Wks,
    Assign,
}

impl MaterialKind {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "prac" => Some(Self::Prac),
            "lec" => Some(Self::Lec),
            "wks" => Some(Self::Wks),
            "assign" => Some(Self::Assign),
            _ => None,
        }
    }

    fn name(self) -> &'static str {
        match self {
            Self::Prac => "prac",
            Self::Lec => "lec",
            Self::Wks => "wks",
            Self::Assign => "assign",
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Material {
    label: String,
    page: String,
    #[serde(skip_serializing)]
    typst: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pdf: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    python: Option<String>,
}

#[derive(Serialize)]
pub(super) struct Catalogue<'a> {
    updated: &'a str,
    course: &'a str,
    #[serde(rename = "type")]
    kind: MaterialKind,
    route: &'a str,
    source: &'a str,
    items: &'a [Material],
}

static CONFIG: LazyLock<Result<SourceConfig, ConfigError>> = LazyLock::new(|| parse_source(SOURCE));

pub(super) fn catalogue(
    course: &str,
    kind: &str,
) -> Result<Option<Catalogue<'static>>, ConfigError> {
    let Some(kind) = MaterialKind::parse(kind) else {
        return Ok(None);
    };
    let config = CONFIG.as_ref().map_err(|_| ConfigError)?;
    Ok(config
        .catalogues
        .iter()
        .find(|catalogue| catalogue.course == course && catalogue.kind == kind)
        .map(|catalogue| Catalogue {
            updated: &config.updated,
            course: &catalogue.course,
            kind: catalogue.kind,
            route: &catalogue.route,
            source: &catalogue.source,
            items: &catalogue.items,
        }))
}

pub(super) fn ready() -> bool {
    CONFIG.is_ok()
}

fn parse_source(source: &str) -> Result<SourceConfig, ConfigError> {
    let config: SourceConfig = toml::from_str(source).map_err(|_| ConfigError)?;
    validate(&config)?;
    Ok(config)
}

fn validate(config: &SourceConfig) -> Result<(), ConfigError> {
    if date_ms(&config.updated).is_none()
        || config.catalogues.is_empty()
        || config.catalogues.len() > MAX_CATALOGUES
    {
        return Err(ConfigError);
    }

    let mut identities = BTreeSet::new();
    for catalogue in &config.catalogues {
        if !course_code(&catalogue.course)
            || !identities.insert((catalogue.course.as_str(), catalogue.kind.name()))
            || !catalogue.source.starts_with("https://github.com/")
            || !text(&catalogue.source, 300)
            || catalogue.items.is_empty()
            || catalogue.items.len() > MAX_ITEMS
        {
            return Err(ConfigError);
        }

        let subject = &catalogue.course[..4];
        let number = &catalogue.course[4..];
        let course_route = format!("/{subject}/{number}/");
        if !local_route(&catalogue.route)
            || !catalogue.route.starts_with(&course_route)
            || !catalogue.route.ends_with('/')
            || catalogue.route[course_route.len()..catalogue.route.len() - 1].is_empty()
            || catalogue.route[course_route.len()..catalogue.route.len() - 1].contains('/')
        {
            return Err(ConfigError);
        }
        let expected_route = &catalogue.route;

        let asset_root = format!(
            "/assets/materials/{}/{}/",
            catalogue.course.to_ascii_lowercase(),
            catalogue.kind.name()
        );
        let mut labels = BTreeSet::new();
        let mut paths = BTreeSet::new();
        for item in &catalogue.items {
            if !text(&item.label, 80)
                || !labels.insert(item.label.as_str())
                || !local_route(&item.page)
                || !item.page.starts_with(expected_route)
                || !item.page.ends_with('/')
                || item.typst.is_none() && item.python.is_none()
            {
                return Err(ConfigError);
            }
            for path in [&item.typst, &item.pdf, &item.python].into_iter().flatten() {
                if !paths.insert(path.as_str()) || !local_route(path) {
                    return Err(ConfigError);
                }
            }
            if item
                .typst
                .as_deref()
                .is_some_and(|path| !path.starts_with(&asset_root) || !path.ends_with(".typ"))
                || item.pdf.as_deref().is_some_and(|path| {
                    !path.starts_with(expected_route) || !path.ends_with(".pdf")
                })
                || item.python.as_deref().is_some_and(|path| {
                    !path.starts_with(&asset_root)
                        || !path.ends_with(".py")
                        || path.ends_with(".adv.py")
                })
                || item.pdf.is_some() != item.typst.is_some()
            {
                return Err(ConfigError);
            }
        }
    }

    if serde_json::to_vec(config).map_err(|_| ConfigError)?.len() > MAX_RESPONSE_BYTES {
        return Err(ConfigError);
    }
    Ok(())
}

fn local_route(path: &str) -> bool {
    path.starts_with('/')
        && path.len() <= 300
        && !path.contains("..")
        && !path.contains("//")
        && !path.contains(['?', '#', '\\'])
        && !path.chars().any(char::is_control)
}

#[cfg(test)]
mod tests {
    use super::{SOURCE, catalogue, parse_source, ready};

    #[test]
    fn configured_practicals_expose_pdfs_and_plain_python() {
        assert!(ready());
        let response = catalogue("MECH2700", "prac").unwrap().unwrap();
        let value = serde_json::to_value(response).unwrap();
        assert_eq!(value["type"], "prac");
        assert_eq!(value["items"].as_array().unwrap().len(), 12);
        assert!(value["items"][0].get("typst").is_none());
        assert_eq!(
            value["items"][0]["pdf"],
            "/MECH/2700/Practicals/week_01.pdf"
        );
        assert_eq!(
            value["items"][11]["python"],
            "/assets/materials/mech2700/prac/week_13.py"
        );
        assert!(
            value["items"]
                .as_array()
                .unwrap()
                .iter()
                .all(|item| !item["python"].as_str().unwrap().ends_with(".adv.py"))
        );
        assert!(catalogue("MECH2700", "tutorial").unwrap().is_none());
        assert!(catalogue("INFS2200", "prac").unwrap().is_none());
    }

    #[test]
    fn material_config_rejects_advanced_python_and_cross_course_assets() {
        assert!(parse_source(&SOURCE.replace("week_02.py", "week_02.adv.py")).is_err());
        assert!(
            parse_source(&SOURCE.replacen("pdf = \"/MECH/2700/Practicals/week_01.pdf\"\n", "", 1))
                .is_err()
        );
        assert!(
            parse_source(&SOURCE.replace(
                "/assets/materials/mech2700/prac/week_02.typ",
                "/assets/materials/infs2200/prac/week_02.typ"
            ))
            .is_err()
        );
        assert!(parse_source(&SOURCE.replace("/Practicals/", "/PracticalSheets/")).is_ok());
    }
}
