#import "template.typ": sheet
#show: body => sheet(week: 7, body)

#heading(level: 1, numbering: none)[Question 1.]
<question-1.>
Write the aircraft equation of motion as a system of two first-order ODEs.

#block[
The equation of motion is $ m dot.double(x) = F - 1 / 2 C_D A_(upright(r e f)) rho V^2 $

Define the velocity as $ V = dot(x) $

Therefore, $ dot(V) = dot.double(x) $

Dividing the equation of motion by the mass gives $ dot(V) = F / m - frac(C_D A_(upright(r e f)) rho, 2 m) V^2 $

Hence, the required first-order system is $ #box(stroke: black, inset: 3pt, [$ frac(d x, d t) & = V\
frac(d V, d t) & = F / m - frac(C_D A_(upright(r e f)) rho, 2 m) V^2 $]) $

Using $ F & = 242000 med upright(N)\, & m & = 70000 med upright(k g)\
C_D & = 0.08\, & A_(upright(r e f)) & = 125 med upright(m^2)\
rho & = 1.225 med upright(k g thin m^(- 3)) $

gives $ F / m = 242000 / 70000 approx 3.457143 med upright(m thin s^(- 2)) $

and $ frac(C_D A_(upright(r e f)) rho, 2 m) = frac(\(0.08\)\(125\)\(1.225\), 2\(70000\)) = 8.75 times 10^(- 5) med upright(m^(- 1)) $

With position and velocity expressed in SI units, $ #box(stroke: black, inset: 3pt, [$ frac(d x, d t) & = V\
frac(d V, d t) & = frac(242000 - 6.125 V^2, 70000) $]) $

Taking the state vector as $ upright(bold(y)) = mat(delim: "[", x; v) $

the system can be written as $ #box(stroke: black, inset: 3pt, [$ frac(d upright(bold(y)), d t) = upright(bold(f))\(t\,upright(bold(y))\)= mat(delim: "[", V; frac(242000 - 6.125 V^2, 70000)) $]) $

]
