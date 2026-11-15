#import "template.typ": sheet
#show: body => sheet(week: 12, body)

#heading(level: 1, numbering: none)[Part 1 Theory]
<part-1-theory>
#block[
Write Burgers' equation in conservation form with flux $ f\(u\)= u^2 / 2 $ The Rankine--Hugoniot condition gives the shock speed $ V_s & = frac(f\(u_L\)- f\(u_R\), u_L - u_R)\
 & = frac(u_L^2 - u_R^2, 2\(u_L - u_R\))\
 & = frac(u_L + u_R, 2) $ For $u_L = 2 med upright(m thin s^(- 1))$ and $u_R = 1 med upright(m thin s^(- 1))$, $ #box(stroke: black, inset: 3pt, [$ V_s = 1.5 med upright(m thin s^(- 1)) $]) $

]
#heading(level: 1, numbering: none)[Part 2 Programming]
<part-2-programming>
#block[
Both velocities are positive, so information travels from left to right and the upwind flux at node $i$ comes from node $i - 1$ $ frac(u_i^(n + 1) - u_i^n, Delta t) + frac(\(u_i^n\)^2\/2 -\(u_(i - 1)^n\)^2\/2, Delta x) = 0 $ Solving for the new value gives the implemented update $ #box(stroke: black, inset: 3pt, [$ u_i^(n + 1) = u_i^n - frac(Delta t, 2 Delta x) [\( u_i^n \)^2 - \( u_(i - 1)^n \)^2] $]) $ Running the supplied problem with this update gives $ V_(s\,upright(c o n s e r v a t i v e)) approx 1.4993446 med upright(m thin s^(- 1)) $ This differs from the theoretical value by about $0.0437 %$, whereas the original convective update gives $ V_(s\,upright(c o n v e c t i v e)) approx 1.4145145 med upright(m thin s^(- 1)) $ which is about $5.70 %$ low

The conservative form is therefore much more accurate for the shock because it enforces the discrete flux balance and hence the Rankine--Hugoniot jump condition

The convective and conservative differential forms are equivalent for smooth solutions, but the product-rule step connecting them is invalid across a discontinuity

]
#heading(level: 1, numbering: none)[Practice Question 1]
<practice-question-1>
#block[
Taylor expansion about node $\(i\,j\)$ gives $ frac(u_(i + 1\,j) - 2 u_(i\,j) + u_(i - 1\,j), h^2) = u_(x x) + h^2 / 12 u_(x x x x) + O\(h^4\) $ and similarly $ frac(u_(i\,j + 1) - 2 u_(i\,j) + u_(i\,j - 1), h^2) = u_(y y) + h^2 / 12 u_(y y y y) + O\(h^4\) $ The discrete PDE therefore represents $ u_(x x) + u_(y y) + h^2 / 12 (u_(x x x x) + u_(y y y y)) + O\(h^4\)= 0 $ Using the residual convention for local truncation error, its leading term is $ #box(stroke: black, inset: 3pt, [$ tau_(i\,j) = h^2 / 12 (u_(x x x x) + u_(y y y y)) $]) $ Differentiating $u_(x x) + u_(y y) = 0$ twice also gives the equivalent form $ #box(stroke: black, inset: 3pt, [$ tau_(i\,j) = - h^2 / 6 u_(x x y y) $]) $ so the central-difference Laplacian is second-order accurate

]
#heading(level: 1, numbering: none)[Practice Question 2]
<practice-question-2>
#block[
Let $h_c$ denote the heat-transfer coefficient so it is not confused with the grid spacing used in Question 1

A first-order backward difference uses the boundary node and the adjacent interior node $ #box(stroke: black, inset: 3pt, [$ frac(T_(3\,3) - T_(3\,2), Delta y) = h_c (T_(3\,3) - T_a) $]) $ Equivalently, $ #box(stroke: black, inset: 3pt, [$ T_(3\,3) = frac(T_(3\,2) - h_c Delta y thin T_a, 1 - h_c Delta y) $]) $

]
#heading(level: 1, numbering: none)[Practice Question 3]
<practice-question-3>
#block[
The second-order backward approximation at the top boundary is $ #box(stroke: black, inset: 3pt, [$ frac(3 T_(3\,3) - 4 T_(3\,2) + T_(3\,1), 2 Delta y) = h_c (T_(3\,3) - T_a) $]) $ Solving for the boundary temperature gives $ #box(stroke: black, inset: 3pt, [$ T_(3\,3) = frac(4 T_(3\,2) - T_(3\,1) - 2 h_c Delta y thin T_a, 3 - 2 h_c Delta y) $]) $

]
