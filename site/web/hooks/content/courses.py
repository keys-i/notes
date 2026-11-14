"""Validate the shared course catalogue for static builds"""

import json
import tomllib
from datetime import date
from pathlib import Path

CATALOGUE_URL = "https://learn.uq.edu.au/ultra/catalog"
MAX_COURSES = 128
MAX_RESPONSE_BYTES = 96 * 1024
PREFIXES_BY_AREA = {
    "computing": {"COMP", "COMS", "COSC", "CSSE"},
    "design": {"DECO", "DSGN"},
    "engineering": {"ENGG", "MECH"},
    "information-systems": {"INFS"},
    "mathematics": {"MATH"},
    "science": {"BIOE", "BIOL", "BIOM", "BIOI", "CHEM", "ERTH", "PHYS", "SCIE"},
    "security": {"CYBR"},
    "statistics": {"STAT"},
}
MATURITIES = {"source", "resources", "learning"}
COURSE_FIELDS = {
    "code",
    "title",
    "maturity",
    "route",
    "verified",
    "catalogue-id",
    "offering",
    "papers-route",
    "cheatsheet-route",
    "folder-code",
    "source-permission",
    "review",
}
REQUIRED_COURSE_FIELDS = {"code", "title", "maturity", "verified"}
LEARNING_FIELDS = {
    "topic-map",
    "concepts",
    "worked-example",
    "practice",
    "misconceptions",
    "assessment",
}


def load_courses(
    config_path: Path,
    content_root: Path,
    today: date,
) -> tuple[dict, ...]:
    """Return normalised courses after validating source and local actions"""
    source = tomllib.loads(config_path.read_text(encoding="utf-8"))
    _fields(source, {"updated", "courses"}, {"updated", "courses"}, "catalogue")
    updated = _date(source["updated"], "updated")
    if updated > today:
        raise ValueError("updated date is in the future")

    raw_courses = source["courses"]
    if not isinstance(raw_courses, list) or not 1 <= len(raw_courses) <= MAX_COURSES:
        raise ValueError("courses must contain between 1 and 128 records")

    seen = set()
    loaded = []
    for raw in raw_courses:
        course = _course(raw, content_root, today)
        if course["code"] in seen:
            raise ValueError(f"duplicate course code: {course['code']}")
        seen.add(course["code"])
        loaded.append(course)
    loaded.sort(key=lambda course: course["code"])

    response = json.dumps(
        {"updated": source["updated"], "courses": loaded},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode()
    if len(response) > MAX_RESPONSE_BYTES:
        raise ValueError("course response exceeds 96 KiB")
    return tuple(loaded)


def site_courses(
    config_path: Path,
    content_root: Path,
    today: date,
) -> tuple[dict, ...]:
    """Return every local course page enriched by matching catalogue data"""
    configured = {
        course["code"]: course
        for course in load_courses(config_path, content_root, today)
    }
    discovered = []
    for subject in sorted(content_root.iterdir()):
        if not subject.is_dir():
            continue
        for number in sorted(subject.iterdir()):
            code = subject.name + number.name
            hub = number / "index.md"
            if not number.is_dir() or not hub.is_file() or not _course_code(code):
                continue
            discovered.append(configured.get(code) or _local_course(code, number))
    return tuple(sorted(discovered, key=lambda course: course["code"]))


def _course(raw: object, content_root: Path, today: date) -> dict:
    _fields(raw, COURSE_FIELDS, REQUIRED_COURSE_FIELDS, "course")
    code = raw["code"]
    if not _course_code(code):
        raise ValueError("course code is invalid")
    area = _course_area(code)
    if area is None:
        raise ValueError(f"{code} area is invalid")
    if not _text(raw["title"], 120):
        raise ValueError(f"{code} title is invalid")
    maturity = raw["maturity"]
    if maturity not in MATURITIES:
        raise ValueError(f"{code} maturity is invalid")

    verified = _date(raw["verified"], f"{code} verified")
    if verified > today:
        raise ValueError(f"{code} verified date is in the future")

    relative_route = f"{code[:4]}/{code[4:]}/"
    route = _canonical_route(raw.get("route"), relative_route, code)
    papers_route = _canonical_route(
        raw.get("papers-route"), f"{relative_route}PY/", code
    )
    cheatsheet_route = _cheatsheet_route(
        raw.get("cheatsheet-route"), relative_route, code
    )
    _local_file(content_root, route, "index.md", code, "route")
    _local_file(content_root, papers_route, "index.md", code, "papers route")
    _local_file(content_root, cheatsheet_route, None, code, "cheatsheet route")

    catalogue_id = raw.get("catalogue-id")
    if catalogue_id is not None and not _identifier(catalogue_id):
        raise ValueError(f"{code} catalogue identifier is invalid")
    offering = raw.get("offering")
    if offering is not None and not _text(offering, 120):
        raise ValueError(f"{code} offering is invalid")
    source_url = _source_url(raw, content_root, today, code)
    if catalogue_id is None and source_url is None:
        raise ValueError(f"{code} has no current identity source")

    review = raw.get("review")
    if maturity == "source":
        if route or papers_route or cheatsheet_route or review is not None:
            raise ValueError(f"{code} source maturity advertises local resources")
    elif maturity == "resources":
        if (route is None and cheatsheet_route is None) or review is not None:
            raise ValueError(f"{code} resources maturity is invalid")
    else:
        _review(review, content_root, today, code)
        if route is None:
            raise ValueError(f"{code} learning maturity requires a route")
        _learning(content_root / relative_route, code)

    capabilities = []
    if route:
        capabilities.append("notes")
    if cheatsheet_route:
        capabilities.append("cheatsheet")
    capabilities.append("source")

    course = {
        "code": code,
        "title": raw["title"],
        "area": area,
        "maturity": maturity,
        "verified": raw["verified"],
        "stale": (today - verified).days >= 365,
        "source_label": "UQ catalogue" if catalogue_id else "Course archive",
        "capabilities": capabilities,
    }
    _optional(course, "route", route)
    _optional(course, "catalogue_id", catalogue_id)
    _optional(course, "catalogue_url", CATALOGUE_URL if catalogue_id else None)
    _optional(
        course,
        "catalogue_label",
        f"Open the UQ catalogue and search {code}" if catalogue_id else None,
    )
    _optional(course, "offering", offering)
    _optional(course, "papers_route", papers_route)
    _optional(course, "cheatsheet_route", cheatsheet_route)
    _optional(course, "source_url", source_url)
    return course


def _local_course(code: str, root: Path) -> dict:
    area = _course_area(code)
    if area is None:
        raise ValueError(f"{code} area is invalid")
    title = _title((root / "index.md").read_text(encoding="utf-8"), code)
    route = f"/{code[:4]}/{code[4:]}/"
    course = {
        "code": code,
        "title": title,
        "area": area,
        "maturity": "resources",
        "route": route,
        "capabilities": ["notes"],
    }
    if (root / "PY/index.md").is_file():
        course["papers_route"] = f"{route}PY/"
        course["capabilities"].append("papers")
    if (root / "CS/index.md").is_file():
        course["cheatsheet_route"] = f"{route}CS/"
        course["capabilities"].append("cheatsheet")
    return course


def _course_area(code: str) -> str | None:
    return next(
        (area for area, prefixes in PREFIXES_BY_AREA.items() if code[:4] in prefixes),
        None,
    )


def _title(source: str, code: str) -> str:
    lines = source.splitlines()
    if not lines or lines[0] != "---":
        raise ValueError(f"{code} route has no front matter")
    try:
        end = lines.index("---", 1)
    except ValueError as error:
        raise ValueError(f"{code} route has invalid front matter") from error
    marker = "title:"
    title = next(
        (
            line[len(marker) :].strip()
            for line in lines[1:end]
            if line.startswith(marker)
        ),
        "",
    )
    if title.startswith(code):
        title = title[len(code) :].strip()
    if not _text(title, 120):
        raise ValueError(f"{code} title is invalid")
    return title


def _fields(
    value: object,
    allowed: set[str],
    required: set[str],
    label: str,
) -> None:
    if not isinstance(value, dict):
        raise TypeError(f"{label} must be a table")
    unknown = value.keys() - allowed
    missing = required - value.keys()
    if unknown:
        raise ValueError(
            f"{label} has unsupported fields: {', '.join(sorted(unknown))}"
        )
    if missing:
        raise ValueError(f"{label} is missing fields: {', '.join(sorted(missing))}")


def _date(value: object, label: str) -> date:
    if (
        not isinstance(value, str)
        or len(value) != 10
        or value[4] != "-"
        or value[7] != "-"
    ):
        raise ValueError(f"{label} date is invalid")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"{label} date is invalid") from error
    if parsed.year < 1970:
        raise ValueError(f"{label} date is invalid")
    return parsed


def _course_code(value: object) -> bool:
    return (
        isinstance(value, str)
        and len(value) == 8
        and value[:4].isalpha()
        and value[:4].isascii()
        and value[:4].isupper()
        and value[4:].isascii()
        and value[4:].isdigit()
    )


def _text(value: object, maximum: int) -> bool:
    return (
        isinstance(value, str)
        and bool(value.strip())
        and len(value) <= maximum
        and not any(
            ord(character) < 32 or 127 <= ord(character) <= 159 for character in value
        )
    )


def _identifier(value: object) -> bool:
    return (
        isinstance(value, str)
        and 10 <= len(value) <= 128
        and value.isascii()
        and all(character.isalnum() or character in "-_" for character in value)
    )


def _canonical_route(value: object, expected: str, code: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or value != expected:
        raise ValueError(f"{code} route is invalid")
    return f"/{value}"


def _cheatsheet_route(value: object, course_route: str, code: str) -> str | None:
    if value is None:
        return None
    if (
        not isinstance(value, str)
        or not len(course_route) < len(value) <= 240
        or not value.startswith(course_route)
        or ".." in value
        or "//" in value
        or "\\" in value
        or any(
            ord(character) < 32 or 127 <= ord(character) <= 159 for character in value
        )
    ):
        raise ValueError(f"{code} cheatsheet route is invalid")
    return f"/{value}"


def _local_file(
    content_root: Path,
    route: str | None,
    suffix: str | None,
    code: str,
    label: str,
) -> None:
    if route is None:
        return
    target = content_root / route.removeprefix("/")
    if suffix:
        target /= suffix
    if not target.is_file():
        raise ValueError(f"{code} {label} does not exist")


def _source_url(raw: dict, content_root: Path, today: date, code: str) -> str | None:
    folder = raw.get("folder-code")
    folder_url = _folder_url(folder, code) if folder is not None else None
    permission = raw.get("source-permission")
    if permission is None:
        return None
    _fields(
        permission,
        {"status", "record", "expires"},
        {"status", "record", "expires"},
        f"{code} source permission",
    )
    expected = f"docs/sources/{code}.md"
    if (
        folder_url is None
        or permission["status"] != "allowed"
        or permission["record"] != expected
    ):
        raise ValueError(f"{code} source permission is invalid")
    expires = _date(permission["expires"], f"{code} permission expiry")
    if expires < today:
        return None
    if not (content_root.parent / expected).is_file():
        raise ValueError(f"{code} source permission record does not exist")
    return folder_url


def _folder_url(value: object, code: str) -> str:
    if not isinstance(value, str):
        raise TypeError(f"{code} folder identifier is invalid")
    folder, separator, query = value.partition("?")
    if not _identifier(folder):
        raise ValueError(f"{code} folder identifier is invalid")
    if not separator:
        return f"https://drive.google.com/drive/folders/{folder}"
    resource_key = query.removeprefix("resourcekey=")
    if query == resource_key or not _identifier(resource_key):
        raise ValueError(f"{code} folder identifier is invalid")
    return f"https://drive.google.com/drive/folders/{folder}?resourcekey={resource_key}"


def _review(
    review: object,
    content_root: Path,
    today: date,
    code: str,
) -> None:
    _fields(
        review, {"role", "date", "record"}, {"role", "date", "record"}, f"{code} review"
    )
    expected = f"docs/reviews/{code}.md"
    if not _text(review["role"], 120) or review["record"] != expected:
        raise ValueError(f"{code} review is invalid")
    reviewed = _date(review["date"], f"{code} review")
    if reviewed > today or (today - reviewed).days >= 365:
        raise ValueError(f"{code} review is not current")
    if not (content_root.parent / expected).is_file():
        raise ValueError(f"{code} review record does not exist")


def _learning(course_root: Path, code: str) -> None:
    hub = course_root / "index.md"
    source = hub.read_text(encoding="utf-8")
    front_matter = _front_matter(source, code)
    references = front_matter.get("learning")
    _fields(references, LEARNING_FIELDS, LEARNING_FIELDS, f"{code} learning map")
    for name, reference in references.items():
        _teaching_anchor(course_root, name, reference, code)


def _front_matter(source: str, code: str) -> dict:
    lines = source.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError(f"{code} route has no front matter")
    try:
        end = lines.index("---", 1)
    except ValueError as error:
        raise ValueError(f"{code} route has invalid front matter") from error
    learning = {}
    active = False
    for line in lines[1:end]:
        if line == "learning:":
            active = True
        elif active and line.startswith("  "):
            key, separator, value = line.strip().partition(":")
            if not separator:
                raise ValueError(f"{code} learning map is invalid")
            learning[key] = value.strip()
        elif active:
            break
    return {"learning": learning} if active else {}


def _teaching_anchor(course_root: Path, name: str, reference: str, code: str) -> None:
    relative, separator, anchor = reference.partition("#")
    path = Path(relative)
    if (
        not relative.endswith(".md")
        or path.is_absolute()
        or ".." in path.parts
        or "\\" in relative
    ):
        raise ValueError(f"{code} {name} reference is invalid")
    target = course_root / path
    if name == "assessment" and not separator:
        if not target.is_file():
            raise ValueError(f"{code} {name} reference does not exist")
        return
    if not separator or not anchor:
        raise ValueError(f"{code} {name} reference is invalid")
    if not target.is_file() or anchor not in _heading_anchors(
        target.read_text(encoding="utf-8")
    ):
        raise ValueError(f"{code} {name} teaching anchor does not exist")


def _heading_anchors(source: str) -> set[str]:
    anchors = set()
    for line in source.splitlines():
        heading = line.lstrip()
        level = len(heading) - len(heading.lstrip("#"))
        if not 1 <= level <= 6 or len(heading) <= level or heading[level] != " ":
            continue
        title = heading[level + 1 :].strip()
        marker = title.rfind("{#")
        if marker >= 0 and title.endswith("}"):
            anchors.add(title[marker + 2 : -1])
        slug = _slug(title[:marker].strip() if marker >= 0 else title)
        if slug:
            anchors.add(slug)
    return anchors


def _slug(value: str) -> str:
    slug = []
    for character in value.casefold():
        if character.isalnum() or character == "_":
            slug.append(character)
        elif slug and slug[-1] != "-":
            slug.append("-")
    return "".join(slug).strip("-")


def _optional(target: dict, key: str, value: object) -> None:
    if value is not None:
        target[key] = value
