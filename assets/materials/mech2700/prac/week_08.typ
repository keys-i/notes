#import "template.typ": sheet
#show: body => sheet(week: 8, body)

#heading(level: 1, numbering: none)[Question 1.]
<question-1.>
Rearrange the velocity equation into a root-finding problem and verify that $50 med upright(k P a) lt.eq p lt.eq p_0$ contains a root.

#block[
Subtracting the measured velocity gives $ #box(stroke: black, inset: 3pt, [$ f\(p\)= sqrt(2 c_p T_0 [1 - (p / p_0)^(\(gamma - 1\)\/gamma)]) - 700 = 0 $]) $ With all pressures in pascals, $ f\(p\)= sqrt(1809000 [1 - (p / 350000)^(2\/7)]) - 700 $ This function is continuous on $\[50000\,350000\]$, since the square-root argument is non-negative throughout the interval. At its endpoints, $ f\(50000\) & approx 178.359052 med upright(m thin s^(- 1)) > 0\,\
f\(350000\) & = - 700 med upright(m thin s^(- 1)) < 0 . $ Therefore, the Intermediate Value Theorem guarantees at least one root. The velocity decreases strictly as pressure increases, so this root is unique.

]
