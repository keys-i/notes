#let result(body) = box(
  stroke: 0.8pt,
  radius: 2pt,
  inset: (x: 5pt, y: 3pt),
  body,
)

#let handout(title: none, author: "Radhesh Goel", body) = {
  set document(title: title, author: author)
  set page(paper: "a4", margin: (x: 22mm, y: 20mm))
  set text(size: 11pt)
  set par(justify: true, leading: 0.65em)
  set heading(numbering: none)

  show heading.where(level: 1): set block(above: 1.4em, below: 0.55em)
  show heading.where(level: 1): set text(size: 16pt, weight: "bold")
  show heading.where(level: 2): set block(above: 1em, below: 0.4em)
  show heading.where(level: 2): set text(size: 13pt, weight: "bold")
  show math.equation.where(block: true): set block(above: 0.55em, below: 0.55em)

  align(center)[
    #text(size: 24pt, weight: "bold")[#title]
    #v(0.45em)
    #author
    #linebreak()
    #datetime.today().display("[day] [month repr:long] [year]")
  ]

  v(1.5em)
  body
}
