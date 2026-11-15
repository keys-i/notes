#import "handout.typ": handout, result
#show: handout.with(title: "Week 7")

= Question 1

Write the aircraft equation of motion as two first-order ODEs

Start with

$ m (dif^2 x) / (dif t^2) = F - 1 / 2 C_D A_("ref") rho V^2 $

Defining velocity as $V = dif x / dif t$ gives
$dif V / dif t = dif^2 x / dif t^2$. Dividing the equation of motion by mass
then gives

$ (dif V) / (dif t) = F / m - (C_D A_("ref") rho) / (2m) V^2 $

The first-order system is

#align(center)[
  #result[$
    (dif x) / (dif t) &= V \
    (dif V) / (dif t) &= F / m - (C_D A_("ref") rho) / (2m) V^2
  $]
]

Use

$
  F &= 242000 upright(" N"), & m &= 70000 upright(" kg") \
  C_D &= 0.08, & A_("ref") &= 125 upright(" m")^2 \
  rho &= 1.225 upright(" kg") upright(" m")^(-3)
$

The two coefficients are

$
  F / m &= 242000 / 70000 approx 3.457143 upright(" m") upright(" s")^(-2) \
  (C_D A_("ref") rho) / (2m)
  &= ((0.08)(125)(1.225)) / (2(70000)) \
  &= 8.75 times 10^(-5) upright(" m")^(-1)
$

With position and velocity in SI units,

#align(center)[
  #result[$
    (dif x) / (dif t) &= V \
    (dif V) / (dif t) &= (242000 - 6.125 V^2) / 70000
  $]
]

For the state vector $bold(y) = mat(x; V)$, this becomes

#align(center)[
  #result[$
    (dif bold(y)) / (dif t)
    = bold(f)(t, bold(y))
    = mat(V; (242000 - 6.125 V^2) / 70000)
  $]
]
