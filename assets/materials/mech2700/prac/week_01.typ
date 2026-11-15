#import "handout.typ": handout, result
#show: handout.with(title: "Week 1")

= Question 1

Divide by $2$ repeatedly, keep each remainder, then read the remainders from
bottom to top

== 1

$
  17 / 2 &= 8 quad "rem" quad 1 \
  8 / 2  &= 4 quad "rem" quad 0 \
  4 / 2  &= 2 quad "rem" quad 0 \
  2 / 2  &= 1 quad "rem" quad 0 \
  1 / 2  &= 0 quad "rem" quad 1
$

#align(center)[#result[$17_10 = (10001)_2$]]

== 2

$
  227 / 2 &= 113 quad "rem" quad 1 \
  113 / 2 &= 56  quad "rem" quad 1 \
  56 / 2  &= 28  quad "rem" quad 0 \
  28 / 2  &= 14  quad "rem" quad 0 \
  14 / 2  &= 7   quad "rem" quad 0 \
  7 / 2   &= 3   quad "rem" quad 1 \
  3 / 2   &= 1   quad "rem" quad 1 \
  1 / 2   &= 0   quad "rem" quad 1
$

#align(center)[#result[$227_10 = (11100011)_2$]]

#pagebreak(weak: true)

== 3

Start with the whole-number part:

$
  55 / 2 &= 27 quad "rem" quad 1 \
  27 / 2 &= 13 quad "rem" quad 1 \
  13 / 2 &= 6  quad "rem" quad 1 \
  6 / 2  &= 3  quad "rem" quad 0 \
  3 / 2  &= 1  quad "rem" quad 1 \
  1 / 2  &= 0  quad "rem" quad 1
$

This gives $55_10 = (110111)_2$. For the fractional part,

$
  0.4 times 2 &= 0.8 &&arrow 0 \
  0.8 times 2 &= 1.6 &&arrow 1 \
  0.6 times 2 &= 1.2 &&arrow 1 \
  0.2 times 2 &= 0.4 &&arrow 0
$

The same four digits now repeat, so $0.4_10 = (0.overline(0110))_2$ and

#align(center)[#result[$55.4_10 = (110111.overline(0110))_2$]]

= Question 2

Each binary digit contributes its value times the matching power of $2$

== 1

$
  (1010101)_2
  &= 1(2^6) + 0(2^5) + 1(2^4) + 0(2^3) + 1(2^2) + 0(2^1) + 1(2^0) \
  &= 64 + 16 + 4 + 1 \
  &= 85
$

#align(center)[#result[$(1010101)_2 = 85_10$]]

== 2

The whole-number part is

$ (11)_2 = 1(2^1) + 1(2^0) = 3 $

The fractional part is a geometric series:

$ (0.101010 dots.h)_2 = 1 / 2 + 1 / 2^3 + 1 / 2^5 + dots.h = 2 / 3 $

Combining the two parts,

$
  (11.overline(10))_2
  &= 3 + 2 / 3 \
  &= 11 / 3 \
  &= (3.overline(6))_10
$

#align(center)[#result[$(11.overline(10))_2 = 3.overline(6)_10$]]

#pagebreak(weak: true)

= Question 3

== 1

IEEE 754 single precision divides its $32$ bits into

#align(center)[
  #result[1 sign bit + 8 exponent bits + 23 fraction bits]
]

The sign bit sets the sign, the exponent sets the scale, and the fraction holds
the significant digits. Normal values have an implied leading $1$, giving $24$
bits of precision in total

== 2

Machine epsilon for single precision is

$ epsilon_m approx 1.19 times 10^(-7) $

It is the smallest value for which $1 + epsilon_m > 1$ is represented as a
different single-precision number. In practice, that is about seven significant
decimal digits

Rounding enters at every step of an iterative stress calculation. Over many
iterations it can accumulate or make convergence tests misleading, so a
tolerance below the available precision is not useful

== 3

Most decimal fractions, including $0.3$, have no exact binary floating-point
representation. Two formulas can display the same rounded value while storing
slightly different numbers, for example

$ a = 0.30000000000000004, quad b = 0.29999999999999999 $

The comparison `a == b` checks those stored values exactly and is therefore
false. Compare within a suitable tolerance instead:

$ abs(a - b) < epsilon $
