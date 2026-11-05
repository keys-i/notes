# Accessibility statement

UQ Notes is a personal study-notes project. The goal is for everyone to be
able to read the notes, navigate the site and use its core study tools
regardless of technology or ability

## Commitment

The project aims to meet WCAG 2.2 Level AA for its core reading, navigation
and search experience. Accessibility is considered when content, controls or
interactive features change

This is a target, not a claim of audited conformance. The project has not had
a formal accessibility audit or representative user testing

## Supported environments

Accessibility fixes are maintained for the current published site and the
default branch. The site is intended to work with:

- current stable versions of Chrome, Edge, Firefox and Safari on desktop and
  mobile
- keyboard, touch and pointer input
- browser zoom and text scaling
- screen readers that support modern semantic HTML, including VoiceOver and
  NVDA

Not every browser and assistive-technology combination is tested on every
change

## Known limitations

- interactive graphs, plots and Mermaid diagrams may not expose every visual
  relationship through an equivalent text description
- mathematical notation can be announced differently depending on the
  browser, screen reader and MathJax support
- the optional study buddy and playful 404 game have accessible controls, but
  have not completed a full screen-reader compatibility review
- long tables, equations and code samples may require horizontal scrolling at
  high zoom levels

These limitations do not remove the obligation to make the core notes and
navigation usable. Fixes that unblock access take priority over decorative
polish

## Report a barrier

[Open a site bug](https://github.com/keys-i/notes/issues/new?template=site-bug.yml)
and start the title with `[Accessibility]`. Please include:

- the page or feature affected
- what you expected and what happened
- the browser, device and assistive technology involved, if relevant
- a suggested improvement, if you have one

You do not need to disclose a disability or any personal information. Issues
are public, so remove sensitive details. If GitHub is itself a barrier,
contact `@keys-i` through an existing private channel or ask someone to report
on your behalf

This is a personal project, so reports are handled on a best-effort basis and
there is no guaranteed response time

Last updated 5 November 2026
