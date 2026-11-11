"""Validate and render interactive note plots"""

import base64
import html
import json

MAX_SOURCE_BYTES = 128_000
TRACE_TYPES = frozenset(
    {
        "bar",
        "contour",
        "heatmap",
        "mesh3d",
        "scatter",
        "scatter3d",
        "scattergl",
        "surface",
    }
)


def _text(config, name, limit):
    value = config.get(name)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"plot {name} must be a non-empty string")
    if len(value) > limit:
        raise ValueError(f"plot {name} exceeds {limit} characters")
    return value.strip()


def parse_plot(source):
    """Parse the bounded JSON contract shared with the browser runtime"""
    if len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
        raise ValueError("plot JSON exceeds 128 KB")
    try:
        config = json.loads(source)
    except json.JSONDecodeError as error:
        raise ValueError(f"plot fence contains invalid JSON: {error.msg}") from error
    if not isinstance(config, dict):
        raise TypeError("plot fence must contain a JSON object")
    unknown = set(config) - {"data", "description", "layout", "title"}
    if unknown:
        raise ValueError(
            f"plot fence has unsupported fields: {', '.join(sorted(unknown))}"
        )

    title = _text(config, "title", 120)
    description = _text(config, "description", 500)
    data = config.get("data")
    if not isinstance(data, list) or not 1 <= len(data) <= 16:
        raise ValueError("plot data must contain between 1 and 16 traces")
    for index, trace in enumerate(data, start=1):
        if not isinstance(trace, dict):
            raise TypeError(f"plot trace {index} must be an object")
        if trace.get("type") not in TRACE_TYPES:
            raise ValueError(f"plot trace {index} has an unsupported type")
    layout = config.get("layout", {})
    if not isinstance(layout, dict):
        raise TypeError("plot layout must be an object")
    return {
        "title": title,
        "description": description,
        "data": data,
        "layout": layout,
    }


def format_plot(source, language, class_name, options, md, **kwargs):
    """Format a validated plot fence as an accessible lazy-render target"""
    del language, class_name, options, md, kwargs
    config = parse_plot(source)
    payload = json.dumps(config, ensure_ascii=False, separators=(",", ":"))
    encoded = base64.b64encode(payload.encode("utf-8")).decode("ascii")
    title = html.escape(config["title"])
    description = html.escape(config["description"])
    dimension = (
        "3d"
        if any(
            trace["type"] in {"mesh3d", "scatter3d", "surface"}
            for trace in config["data"]
        )
        else "2d"
    )
    return (
        f'<figure class="note-plot note-plot--{dimension}" data-plot="{encoded}" '
        f'data-state="idle" aria-label="{description}" tabindex="0">'
        '<div class="note-plot__canvas" role="img" aria-hidden="true"></div>'
        f"<figcaption><strong>{title}</strong><span>{description}</span></figcaption>"
        "</figure>"
    )
