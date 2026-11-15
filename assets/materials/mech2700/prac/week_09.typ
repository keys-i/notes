#import "template.typ": sheet
#show: body => sheet(week: 9, body)

#heading(level: 1, numbering: none)[Question 1.]
<question-1.>
#heading(level: 2, numbering: none)[a) Surface area as a function of radius]
<a-surface-area-as-a-function-of-radius>
#block[
The fixed-volume constraint and its rearrangement for height are $ V = pi r^2 h\,#h(2em) h = frac(V, pi r^2) . $ Substituting this into the surface-area equation, $ A\(r\) & = 2 pi r (frac(V, pi r^2)) + 2 pi r^2\
 & = frac(2 V, r) + 2 pi r^2 . $ Therefore, for a physically meaningful radius $r > 0$, $ #box(stroke: black, inset: 3pt, [$ A\(r\)= frac(2 V, r) + 2 pi r^2 $]) . $ For $V = 10 med upright(m^3)$, this becomes $A\(r\)= 20\/r + 2 pi r^2$.

]
#heading(level: 2, numbering: none)[b) Bracketing the minimum]
<b-bracketing-the-minimum>
#block[
For $V = 10 med upright(m^3)$, begin with $a = 1.5$ and $b = 2.0$. The corresponding surface areas are $ A\(a\) & = A\(1.5\)= 20 / 1.5 + 2 pi\(1.5\)^2 approx 27.4705 med upright(m^2)\,\
A\(b\) & = A\(2.0\)= 20 / 2.0 + 2 pi\(2.0\)^2 approx 35.1327 med upright(m^2) . $ Since $A\(b\)> A\(a\)$, the downhill direction is towards decreasing radius. Swap $a$ and $b$, giving $a = 2.0$ and $b = 1.5$, then calculate $ c = b + k\(b - a\)= 1.5 + 1.6\(1.5 - 2.0\)= 0.7 . $ At this point, $ A\(c\)= A\(0.7\)= 20 / 0.7 + 2 pi\(0.7\)^2 approx 31.6502 med upright(m^2) . $

Since $A\(b\)< A\(a\)$ and $A\(b\)< A\(c\)$, the minimum is bracketed. The algorithm gives $ #box(stroke: black, inset: 3pt, [$ a = 2.0\,#h(2em) b = 1.5\,#h(2em) c = 0.7 $])\, $ which corresponds to the interval $0.7 < r < 2.0 med upright(m)$, with the middle point at $r = 1.5 med upright(m)$.

]
#heading(level: 1, numbering: none)[Question 2.]
<question-2.>
#heading(level: 2, numbering: none)[Golden-section interval width]
<golden-section-interval-width>
#block[
Each golden-section iteration retains the fraction $ rho = frac(sqrt(5) - 1, 2) approx 0.618 $ of the current uncertainty interval. Starting with a width of $0.80 med upright(m)$, the interval widths are $ upright("After 1 iteration:") quad & 0.80\(0.618\)approx 0.49 med upright(m)\,\
upright("After 2 iterations:") quad & 0.49\(0.618\)approx 0.31 med upright(m)\,\
upright("After 3 iterations:") quad & 0.31\(0.618\)approx 0.19 med upright(m) . $ Equivalently, $ 0.80 (frac(sqrt(5) - 1, 2))^3 approx 0.19 med upright(m) . $ Therefore, the answer is $ #box(stroke: black, inset: 3pt, [$ upright("Option B: ") 0.19 med upright(m) $]) . $

]
#heading(level: 1, numbering: none)[Question 3.]
<question-3.>
#heading(level: 2, numbering: none)[Mapping temperature to the Chebyshev interval]
<mapping-temperature-to-the-chebyshev-interval>
#block[
Map $T in\[20\,80\]$ to $x in\[- 1\,1\]$ using $ x = frac(2\(T - 20\), 80 - 20) - 1 . $ For $T = 35 med upright("degrees Celsius")$, $ x = frac(2\(35 - 20\), 60) - 1 = 30 / 60 - 1 = #box(stroke: black, inset: 3pt, [$ - 0.5 $]) . $

]
