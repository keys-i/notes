# Contributing

These are personal course notes, not an official UQ resource or a shared
archive of course materials. Contributions should improve the accuracy,
clarity, navigation, or presentation of the existing notes.

## Before contributing

- Open an issue before substantial work. A direct pull request is fine for a
  small typo, broken link, or obvious formatting fix.
- Keep each change focused on one course or one site problem.
- The maintainer may decline changes that broaden the repository beyond
  personal course notes.

## Content boundaries

- Write explanations in your own words and cite sources where appropriate.
- Do not add lecture slides, textbook extracts, private course material,
  leaked assessments, or current assessment solutions.
- Do not add personal information about students or teaching staff.
- Check technical claims rather than treating AI output as a source.
- Disclose substantial AI assistance when it affects review, attribution, or
  accuracy.

By contributing, you confirm that you may share the material and agree that
it will be distributed under this repository's
[GNU GPL v2 licence](../LICENSE).

## Editing notes

Course content lives under `notes/markdown/`. Preserve the existing subject,
course, and content-type structure. Match the surrounding Markdown style and
avoid unrelated rewrites.

## Checks

Run:

```sh
uv run fmt
uv run lint
uv run test
uv run mkdocs build --strict
```

For a visible layout change, also check the affected page on desktop and
mobile.

## Pull requests

Explain what changed and why, link any related issue, and name the courses or
pages affected. Include screenshots only when the rendered appearance
changed.
