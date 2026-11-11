#let blue = rgb("#071aab")
#let blue-soft = rgb("#e7ebff")
#let charcoal = rgb("#172229")
#let grey = rgb("#52616a")
#let yellow = rgb("#ffff31")
#let paper = rgb("#fffefa")

#let topic(title, body) = block(
  width: 100%,
  breakable: false,
  inset: (x: 5pt, y: 4pt),
  radius: 4pt,
  stroke: (paint: blue.lighten(70%), thickness: 0.55pt),
  fill: white,
  below: 5pt,
)[
  #block(
    width: 100%,
    inset: (left: 3.5pt, right: 3.5pt, top: 2pt, bottom: 1.8pt),
    radius: 2.5pt,
    fill: blue-soft,
  )[#text(size: 8pt, weight: 800, fill: blue, tracking: 0.03em)[#upper(title)]]
  #v(3pt)
  #body
]

#let rule(label, body) = [
  #text(weight: 700, fill: blue)[#label] #body
]

#let sheet(course, title, scope, body) = {
  set page(
    paper: "a4",
    flipped: true,
    margin: (top: 8mm, bottom: 8mm, left: 9mm, right: 9mm),
    fill: paper,
    header: context [
      #grid(
        columns: (1fr, auto),
        align: (left, right),
        text(size: 6.2pt, weight: 800, fill: blue)[#course],
        text(size: 5.7pt, fill: grey)[EXAM CHEATSHEET],
      )
      #v(1.6pt)
      #line(length: 100%, stroke: (paint: blue, thickness: 0.8pt))
    ],
    footer: context [
      #line(length: 100%, stroke: (paint: blue.lighten(72%), thickness: 0.5pt))
      #v(1.4pt)
      #grid(
        columns: (1fr, auto),
        align: (left, right),
        text(size: 4.9pt, fill: grey)[#scope],
        box(
          inset: (x: 3pt, y: 1pt),
          radius: 2pt,
          fill: yellow,
        )[#text(size: 5pt, weight: 800, fill: charcoal)[#counter(page).display("1")]],
      )
    ],
  )
  set text(font: "Arial", size: 7.9pt, fill: charcoal)
  set par(leading: 0.52em, spacing: 2pt)
  set list(indent: 7pt, body-indent: 3pt, spacing: 1.1pt)
  set enum(indent: 8pt, body-indent: 3pt, spacing: 1.1pt)
  set math.equation(block: false)
  show math.equation: set text(size: 7.9pt)
  show strong: set text(weight: 750)

  grid(
    columns: (1fr, auto),
    column-gutter: 5mm,
    align: (left, right),
    [
      #text(size: 13.5pt, weight: 850, fill: blue, tracking: -0.02em)[#title]
      #v(-1pt)
      #text(size: 5.4pt, fill: grey)[Write the symbolic form first · keep units · check assumptions]
    ],
    box(
      inset: (x: 5pt, y: 3pt),
      radius: 5pt,
      fill: charcoal,
    )[#text(size: 6.2pt, weight: 800, fill: yellow)[#course]],
  )
  v(5pt)
  columns(3, gutter: 5mm, body)
}
