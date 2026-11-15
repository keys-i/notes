#import "handout.typ": handout, result
#show: handout.with(title: "Week 10")

= Question 1

== a) Temperature at the heat-flux boundary

At the left boundary, Fourier's law gives

$ q_("in") = -k ((partial T) / (partial x))_(x=0) $

Use a first-order forward difference at time level $m$:

$ ((partial T) / (partial x))_(x=0, t=t_m) approx (T_1^m - T_0^m) / (Delta x) $

Then

$ q_("in") = -k (T_1^m - T_0^m) / (Delta x) $

Solving for the boundary temperature,

#align(center)[
  #result[$T_0^m = T_1^m + (q_("in") Delta x) / k$]
]

A positive heat flux into the rod requires $T_0^m > T_1^m$, which matches heat
flow towards increasing $x$

== b) Order of accuracy
