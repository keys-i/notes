#import "handout.typ": handout, result
#show: handout.with(title: "Week 3")

= Question 1

Fit a quadratic through the three measurements

$
  (x_0, v_0) = (1.5, 6.23), quad
  (x_1, v_1) = (1.65, 7.09), quad
  (x_2, v_2) = (1.95, 8.97)
$

where $x$ is in metres and $v$ is in millimetres. The first divided differences
are

$
  v[x_0, x_1] &= (7.09 - 6.23) / (1.65 - 1.5) = 5.733333 \
  v[x_1, x_2] &= (8.97 - 7.09) / (1.95 - 1.65) = 6.266667
$

The Newton interpolant is

$ v(x) = 6.23 + 5.733333(x - 1.5) + 1.185185(x - 1.5)(x - 1.65) $

or, after expanding,

$ v(x) = 1.185185x^2 + 2x + 0.563333 $

Differentiating twice,

$
  (dif v) / (dif x) &= 2.370370x + 2 \
  (dif^2 v) / (dif x^2) &= 2.370370
$

The second derivative is constant because the interpolant is quadratic. At
$x = 1.8 upright(" m")$,

#align(center)[
  #result[$
    (dif^2 v) / (dif x^2)
    = 2.37037 upright(" mm") / upright("m")^2
    = 2.37037 times 10^(-3) upright(" m")^(-1)
  $]
]

= Question 2

The beam equation is

$ (dif^2 v) / (dif x^2) = -M / (E I) $

Solving for $E$ gives

$ E = -M / (I (dif^2 v / dif x^2)) $

Convert the moment and second moment of area to SI units:

$ M = -21 upright(" kN") dot upright("m") = -21000 upright(" N") dot upright("m") $

$
  I &= 18.5 times 10^6 upright(" mm")^4 \
    &= 18.5 times 10^6 times 10^(-12) upright(" m")^4 \
    &= 1.85 times 10^(-5) upright(" m")^4
$

#align(center)[
  #result[$
    E
    &= -(-21000) / ((1.85 times 10^(-5))(2.37037 times 10^(-3))) \
    &= 4.78885 times 10^11 upright(" Pa") \
    &approx 479 upright(" GPa")
  $]
]
