#import "template.typ": sheet
#show: body => sheet(week: 4, body)

#heading(level: 1, numbering: none)[Question 1.]
<question-1.>
#block[
The delivery time $x$ is normally distributed with $mu = 0.75 upright(" h")\,#h(2em) sigma = 0.5 upright(" h")$

The required probability is $ p = 1 / sqrt(2 pi sigma^2) integral_0.5^1.0 exp [- frac(\(x - mu\)^2, 2 sigma^2)] d x $

Substituting $mu = 0.75$ and $sigma = 0.5$, $ p = 1 / sqrt(2 pi\(0.5\)^2) integral_0.5^1.0 exp [- frac(\(x - 0.75\)^2, 2\(0.5\)^2)] d x $

#heading(level: 2, numbering: none)[Two-point Gaussian quadrature]
<two-point-gaussian-quadrature>
For two-point Gauss--Legendre quadrature, the points and weights on $\[- 1\,1\]$ are $ xi_1 = - 1 / sqrt(3)\,#h(2em) xi_2 = 1 / sqrt(3) $ $ w_1 = w_2 = 1 $

Transform from $\[- 1\,1\]$ to $\[0.5\,1.0\]$: $ x = frac(a + b, 2) + frac(b - a, 2) xi $

Here, $ frac(a + b, 2) = 0.75\,#h(2em) frac(b - a, 2) = 0.25 . $ Therefore, the quadrature points are $ x_1 = 0.75 - 0.25 / sqrt(3) = 0.6056624\, $ $ x_2 = 0.75 + 0.25 / sqrt(3) = 0.8943376 . $ Define $ f\(x\)= 1 / sqrt(2 pi\(0.5\)^2) exp [- frac(\(x - 0.75\)^2, 2\(0.5\)^2)] . $ At both quadrature points, $ f\(x_1\)= f\(x_2\)approx 0.76532246 . $ The two-point Gaussian quadrature estimate is $ p approx frac(b - a, 2) [f \( x_1 \) + f \( x_2 \)] . $ Thus, $ p approx 0.25\(0.76532246 + 0.76532246\) $ $ #box(stroke: black, inset: 3pt, [$ p_(upright("GQ")) approx 0.38266123 $]) . $ The true value is $ p_(upright("true")) = 0.3829249225480263 . $ Therefore, the absolute error is $ lr(|p_(upright("true")) - p_(upright("GQ"))|) =\|0.3829249225 - 0.3826612294\| $ $ #box(stroke: black, inset: 3pt, [$ upright("Absolute error") approx 2.6369 times 10^(- 4) $]) . $ The percentage relative error is $ frac(2.6369 times 10^(- 4), 0.3829249225) times 100 approx 0.0689 % . $

]
