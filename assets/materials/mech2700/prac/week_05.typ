#import "handout.typ": handout, result
#show: handout.with(title: "Week 5")

= Question 1

The combustion reaction is

$
  upright("CH")_4 + alpha upright("O")_2 + 4 alpha upright("N")_2
  arrow.r
  upright("CO")_2 + 2 upright("H")_2 upright("O")
  + beta upright("NO") + gamma upright("N")_2
$

Balancing oxygen atoms gives

$ 2 alpha = 2 + 2 + beta $

or

#align(center)[#result[$2 alpha - beta = 4$]]

Balancing nitrogen atoms gives

$ 2(4 alpha) = beta + 2 gamma $

or

#align(center)[#result[$8 alpha - beta - 2 gamma = 0$]]

= Question 2

The full system is

$
  2 alpha - beta &= 4 \
  8 alpha - beta - 2 gamma &= 0 \
  2 beta - gamma &= 0
$

With $bold(x) = mat(alpha; beta; gamma)$, the matrix equation is

$
  underbrace(mat(2, -1, 0; 8, -1, -2; 0, 2, -1), bold(A))
  underbrace(mat(alpha; beta; gamma), bold(x))
  = underbrace(mat(4; 0; 0), bold(b))
$

In matrix form,

#align(center)[
  #result[$
    bold(A) = mat(2, -1, 0; 8, -1, -2; 0, 2, -1), quad
    bold(b) = mat(4; 0; 0)
  $]
]
