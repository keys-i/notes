"""Configure example callouts."""

import re

from mkdocs.plugins import event_priority

collapse_examples = re.compile(
    r"(?m)^([ \t]*)!!! example(?=[ \t]|$)"
).sub

on_page_markdown = event_priority(-50)(
    lambda markdown, **_: collapse_examples(r"\1??? example", markdown)
)
