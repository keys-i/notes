"""Configure Mermaid fences without Python-specific YAML tags."""

from mermaid2 import fence_mermaid_custom


def on_config(config):
    superfences = config.mdx_configs.setdefault("pymdownx.superfences", {})
    custom_fences = superfences.setdefault("custom_fences", [])

    if not any(fence.get("name") == "mermaid" for fence in custom_fences):
        custom_fences.insert(
            0,
            {
                "name": "mermaid",
                "class": "mermaid",
                "format": fence_mermaid_custom,
            },
        )

    return config
