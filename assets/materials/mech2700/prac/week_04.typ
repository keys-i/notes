#import "handout.typ": handout, result
#show: handout.with(title: "Week 4")

= Question 1

The delivery time $x$ is normally distributed with
$mu = 0.75 upright(" h")$ and $sigma = 0.5 upright(" h")$. The probability of a
delivery taking between $0.5$ and $1.0$ hours is

$
  p = 1 / sqrt(2 pi sigma^2)
      integral_0.5^1.0 exp(-(x - mu)^2 / (2 sigma^2)) dif x
$

Substituting the given mean and standard deviation,

$
  p = 1 / sqrt(2 pi (0.5)^2)
      integral_0.5^1.0 exp(-(x - 0.75)^2 / (2(0.5)^2)) dif x
$

== Two-point Gaussian quadrature

For two-point Gauss–Legendre quadrature, the points and weights on $[-1, 1]$
are

$ xi_1 = -1 / sqrt(3), quad xi_2 = 1 / sqrt(3), quad w_1 = w_2 = 1 $

Map the standard interval to $[0.5, 1.0]$ with

$ x = (a + b) / 2 + (b - a) / 2 xi $

Here, $(a + b) / 2 = 0.75$ and $(b - a) / 2 = 0.25$, so

$
  x_1 &= 0.75 - 0.25 / sqrt(3) = 0.6056624 \
  x_2 &= 0.75 + 0.25 / sqrt(3) = 0.8943376
$

For

$ f(x) = 1 / sqrt(2 pi (0.5)^2) exp(-(x - 0.75)^2 / (2(0.5)^2)) $

symmetry gives $f(x_1) = f(x_2) approx 0.76532246$. The quadrature estimate is

$
  p
  &approx (b - a) / 2 [f(x_1) + f(x_2)] \
  &= 0.25(0.76532246 + 0.76532246)
$

#align(center)[#result[$p_("GQ") approx 0.38266123$]]

The reference value is $p_("true") = 0.3829249225480263$, giving

$
  abs(p_("true") - p_("GQ"))
  &= abs(0.3829249225 - 0.3826612294) \
  &approx 2.6369 times 10^(-4)
$

#align(center)[#result[Absolute error $approx 2.6369 times 10^(-4)$]]

The percentage relative error is

$ (2.6369 times 10^(-4)) / 0.3829249225 times 100 approx 0.0689 "%" $
