#import "handout.typ": handout, result
#show: handout.with(title: "Week 12")

= Part 1 — Theory

Write Burgers' equation in conservation form with flux

$ f(u) = u^2 / 2 $

The Rankine–Hugoniot condition gives the shock speed

$
  V_s
  &= (f(u_L) - f(u_R)) / (u_L - u_R) \
  &= (u_L^2 - u_R^2) / (2(u_L - u_R)) \
  &= (u_L + u_R) / 2
$

For $u_L = 2 upright(" m") upright(" s")^(-1)$ and
$u_R = 1 upright(" m") upright(" s")^(-1)$,

#align(center)[#result[$V_s = 1.5 upright(" m") upright(" s")^(-1)$]]

= Part 2 — Programming

Both velocities are positive, so information travels from left to right and the
upwind flux at node $i$ comes from node $i - 1$:

$
  (u_i^(n+1) - u_i^n) / (Delta t)
  + (((u_i^n)^2 / 2) - ((u_(i-1)^n)^2 / 2)) / (Delta x)
  = 0
$

Solving for the new value gives the implemented update

#align(center)[
  #result[$
    u_i^(n+1) = u_i^n
    - (Delta t) / (2 Delta x) [(u_i^n)^2 - (u_(i-1)^n)^2]
  $]
]

Running the supplied problem with this update gives

$ V_(s,"conservative") approx 1.4993446 upright(" m") upright(" s")^(-1) $

This is about $0.0437 "%"$ from the theoretical value. The original convective
update gives

$ V_(s,"convective") approx 1.4145145 upright(" m") upright(" s")^(-1) $

which is about $5.70 "%"$ low. The conservative form handles the shock better
because it preserves the discrete flux balance and the Rankine–Hugoniot jump
condition

The convective and conservative differential forms agree for smooth solutions,
but the product-rule step between them does not hold across a discontinuity

#pagebreak(weak: true)

= Practice Question 1

A Taylor expansion about node $(i, j)$ gives

$
  (u_(i+1,j) - 2u_(i,j) + u_(i-1,j)) / h^2
  = u_(x x) + h^2 / 12 u_(x x x x) + cal(O)(h^4)
$

and, in the other direction,

$
  (u_(i,j+1) - 2u_(i,j) + u_(i,j-1)) / h^2
  = u_(y y) + h^2 / 12 u_(y y y y) + cal(O)(h^4)
$

The discrete PDE therefore represents

$
  u_(x x) + u_(y y)
  + h^2 / 12 (u_(x x x x) + u_(y y y y))
  + cal(O)(h^4) = 0
$

With the residual convention, the leading local truncation error is

#align(center)[
  #result[$tau_(i,j) = h^2 / 12 (u_(x x x x) + u_(y y y y))$]
]

Differentiating $u_(x x) + u_(y y) = 0$ twice gives the equivalent form

#align(center)[#result[$tau_(i,j) = -h^2 / 6 u_(x x y y)$]]

so the central-difference Laplacian is second-order accurate

= Practice Question 2

Let $h_c$ denote the heat-transfer coefficient, keeping it distinct from the
grid spacing in Question 1

A first-order backward difference uses the boundary node and its adjacent
interior node:

#align(center)[
  #result[$
    (T_(3,3) - T_(3,2)) / (Delta y) = h_c (T_(3,3) - T_a)
  $]
]

Solving for the boundary temperature gives

#align(center)[
  #result[$
    T_(3,3) = (T_(3,2) - h_c Delta y T_a) / (1 - h_c Delta y)
  $]
]

= Practice Question 3

The second-order backward approximation at the top boundary is

#align(center)[
  #result[$
    (3T_(3,3) - 4T_(3,2) + T_(3,1)) / (2 Delta y)
    = h_c (T_(3,3) - T_a)
  $]
]

Rearranging for the boundary temperature,

#align(center)[
  #result[$
    T_(3,3)
    = (4T_(3,2) - T_(3,1) - 2h_c Delta y T_a) / (3 - 2h_c Delta y)
  $]
]
