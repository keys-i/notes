#import "template.typ": sheet
#show: body => sheet(week: 10, body)

#heading(level: 1, numbering: none)[Question 1]
<question-1>
#heading(level: 2, numbering: none)[a) Temperature at the heat-flux boundary]
<a-temperature-at-the-heat-flux-boundary>
#block[
At the left boundary, Fourier's law gives $ q_(upright(i n)) = - k frac(partial T, partial x)\|_(x = 0) $ Using a first-order forward difference at time level $m$, $ frac(partial T, partial x)\|_(x = 0\,t = t_m) approx frac(T_1^m - T_0^m, Delta x) $ Therefore, $ q_(upright(i n)) = - k frac(T_1^m - T_0^m, Delta x) $ Rearranging for the boundary temperature gives $ #box(stroke: black, inset: 3pt, [$ T_0^m = T_1^m + frac(q_(upright(i n)) Delta x, k) $]) $ A positive heat flux entering the rod requires $T_0^m > T_1^m$, consistent with heat flowing towards increasing $x$

]
#heading(level: 2, numbering: none)[b) Order of accuracy]
<b-order-of-accuracy>
