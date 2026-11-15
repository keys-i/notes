#let sheet(week: none, body) = {
  set page(
    paper: "a4",
    margin: (x: 20mm, y: 18mm),
    numbering: none,
  )
  set text(font: "New Computer Modern", size: 10.5pt)
  set par(justify: true, leading: 0.65em)
  set heading(numbering: none)

  show heading.where(level: 1): heading => block(
    above: 1.5em,
    below: 0.65em,
    text(size: 15pt, weight: "bold", heading.body),
  )
  show heading.where(level: 2): heading => block(
    above: 1.2em,
    below: 0.5em,
    text(size: 12pt, weight: "bold", heading.body),
  )

  align(center)[
    #text(size: 19pt, weight: "bold")[MECH2700]
    #v(0.2em)
    #text(size: 13pt, weight: "semibold")[Week #week solved practical]
  ]
  v(0.8em)
  line(length: 100%, stroke: 0.6pt + rgb("9a9a9a"))
  v(0.3em)

  body
}
