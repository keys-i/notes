#import "handout.typ": handout, result
#show: handout.with(title: "Week 9")

= Question 1

== a) Surface area as a function of radius

For a cylinder of fixed volume,

$ V = pi r^2 h, quad h = V / (pi r^2) $

Substitute for $h$ in the surface-area equation:

$
  A(r)
  &= 2 pi r (V / (pi r^2)) + 2 pi r^2 \
  &= 2V / r + 2 pi r^2
$

For the physical domain $r > 0$,

#align(center)[#result[$A(r) = 2V / r + 2 pi r^2$]]

When $V = 10 upright(" m")^3$, this reduces to $A(r) = 20 / r + 2 pi r^2$

== b) Bracketing the minimum

Take $a = 1.5$ and $b = 2.0$ for $V = 10 upright(" m")^3$. Their surface
areas are

$
  A(a) = A(1.5)
  &= 20 / 1.5 + 2 pi (1.5)^2
  approx 27.4705 upright(" m")^2 \
  A(b) = A(2.0)
  &= 20 / 2.0 + 2 pi (2.0)^2
  approx 35.1327 upright(" m")^2
$

Since $A(b) > A(a)$, move towards smaller radii. Swap $a$ and $b$, then find

$ c = b + k(b - a) = 1.5 + 1.6(1.5 - 2.0) = 0.7 $

At the new point,

$ A(c) = A(0.7) = 20 / 0.7 + 2 pi (0.7)^2 approx 31.6502 upright(" m")^2 $

Now $A(b) < A(a)$ and $A(b) < A(c)$, so the minimum is bracketed by

#align(center)[#result[$a = 2.0, quad b = 1.5, quad c = 0.7$]]

The interval is $0.7 < r < 2.0 upright(" m")$, with the middle point at
$r = 1.5 upright(" m")$

#pagebreak(weak: true)

= Question 2

== Golden-section interval width

Each iteration retains the fraction

$ rho = (sqrt(5) - 1) / 2 approx 0.618 $

of the current interval. From an initial width of $0.80 upright(" m")$,

$
  "After 1 iteration:" &quad 0.80(0.618) approx 0.49 upright(" m") \
  "After 2 iterations:" &quad 0.49(0.618) approx 0.31 upright(" m") \
  "After 3 iterations:" &quad 0.31(0.618) approx 0.19 upright(" m")
$

The same width can be calculated directly:

$ 0.80((sqrt(5) - 1) / 2)^3 approx 0.19 upright(" m") $

#align(center)[#result[Option B: $0.19 upright(" m")$]]

= Question 3

== Mapping temperature to the Chebyshev interval

Map $T in [20, 80]$ to $x in [-1, 1]$ with

$ x = 2(T - 20) / (80 - 20) - 1 $

At $T = 35 degree upright("C")$,

$ x = 2(35 - 20) / 60 - 1 = 30 / 60 - 1 $

#align(center)[#result[$x = -0.5$]]
