#let blue = rgb("#071aab")
#let blue-soft = rgb("#e7ebff")
#let charcoal = rgb("#172229")
#let grey = rgb("#52616a")
#let yellow = rgb("#ffff31")
#let paper = rgb("#fffefa")

#let topic(title, body) = block(
  width: 100%,
  breakable: false,
  inset: (x: 6.5pt, y: 5.7pt),
  radius: 5pt,
  stroke: (paint: blue.lighten(70%), thickness: 0.65pt),
  fill: white,
  below: 6.2pt,
)[
  #block(
    width: 100%,
    inset: (x: 4.5pt, y: 2.5pt),
    radius: 3pt,
    fill: blue-soft,
  )[#text(size: 8.3pt, weight: 800, fill: blue, tracking: 0.03em)[#upper(title)]]
  #v(4pt)
  #body
]

#let rule(label, body) = [
  #text(weight: 700, fill: blue)[#label] #body
]

#let sheet(body) = {
  set page(
    paper: "a4",
    flipped: true,
    margin: (top: 6mm, bottom: 2mm, x: 6mm),
    fill: paper,
  )
  set text(font: "Arial", size: 8.4pt, fill: charcoal)
  set par(leading: 0.63em, spacing: 2.45pt)
  set list(indent: 7.5pt, body-indent: 3.5pt, spacing: 1.5pt)
  set enum(indent: 8.5pt, body-indent: 3.5pt, spacing: 1.5pt)
  set math.equation(block: false)
  show math.equation: set text(size: 8.4pt)
  show strong: set text(weight: 750)

  columns(3, gutter: 4mm, body)
}
