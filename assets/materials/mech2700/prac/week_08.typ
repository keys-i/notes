#import "handout.typ": handout, result
#show: handout.with(title: "Week 8")

= Question 1

Rearrange the velocity equation as a root-finding problem, then check that
$50 upright("kPa") <= p <= p_0$ contains a root

Subtract the measured velocity:

#align(center)[
  #result[$
    f(p) = sqrt(2 c_p T_0 [1 - (p / p_0)^((gamma - 1) / gamma)]) - 700 = 0
  $]
]

Using pascals throughout,

$
  f(p) = sqrt(1809000 [1 - (p / 350000)^(2 / 7)]) - 700
$

The square-root argument is non-negative on $[50000, 350000]$, so $f$ is
continuous there. At the endpoints,

$
  f(50000) &approx 178.359052 upright("m") upright("s")^(-1) > 0 \
  f(350000) &= -700 upright("m") upright("s")^(-1) < 0
$

The Intermediate Value Theorem gives at least one root. Velocity falls
strictly as pressure rises, so the root is unique
