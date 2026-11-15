#import "template.typ": sheet
#show: body => sheet(week: 6, body)

#heading(level: 1, numbering: none)[Question 1.]
<question-1.>
Rewrite Equations (2)--(4) in a form suitable for Jacobi iteration.

#block[
The discretised heat equations are $ - k (frac(T_L - 2 T_0 + T_1, Delta x^2)) & = q\
- k (frac(T_0 - 2 T_1 + T_2, Delta x^2)) & = q\
- k (frac(T_1 - 2 T_2 + T_R, Delta x^2)) & = q $

Define $ C = frac(q Delta x^2, k) $

Using $ k = 170\,#h(2em) q = 4 times 10^5\,#h(2em) Delta x = 0.1 $

gives $ C = frac(\(4 times 10^5\)\(0.1\)^2, 170) = 400 / 17 approx 23.5294 med upright(K) $

Multiplying each equation by $ - frac(Delta x^2, k) $

gives $ T_L - 2 T_0 + T_1 & = - C\
T_0 - 2 T_1 + T_2 & = - C\
T_1 - 2 T_2 + T_R & = - C $

Rearranging for each unknown temperature, $ T_0 & = frac(T_L + T_1 + C, 2)\
T_1 & = frac(T_0 + T_2 + C, 2)\
T_2 & = frac(T_1 + T_R + C, 2) $

Therefore, the Jacobi iteration equations are $ #box(stroke: black, inset: 3pt, [$ T_0^(\(n + 1\)) & = frac(T_L + T_1^(\(n\)) + C, 2)\
T_1^(\(n + 1\)) & = frac(T_0^(\(n\)) + T_2^(\(n\)) + C, 2)\
T_2^(\(n + 1\)) & = frac(T_1^(\(n\)) + T_R + C, 2) $]) $

Substituting the boundary temperatures and the value of $C$, $ #box(stroke: black, inset: 3pt, [$ T_0^(\(n + 1\)) & = 161.7647 + 0.5 T_1^(\(n\))\,\
T_1^(\(n + 1\)) & = 11.7647 + 0.5 T_0^(\(n\)) + 0.5 T_2^(\(n\))\,\
T_2^(\(n + 1\)) & = 386.7647 + 0.5 T_1^(\(n\)) . $]) $

]
