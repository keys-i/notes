#import "template.typ": sheet
#show: body => sheet(week: 3, body)

#heading(level: 1, numbering: none)[Question 1.]
<question-1.>
#block[
Fit a quadratic interpolating polynomial through the three measurements: $ \(x_0\,v_0\)=\(1.5\,6.23\)\,quad\(x_1\,v_1\)=\(1.65\,7.09\)\,quad\(x_2\,v_2\)=\(1.95\,8.97\) $ where $x$ is in metres and $v$ is in millimetres.

The first divided differences are $ v\[x_0\,x_1\]= frac(7.09 - 6.23, 1.65 - 1.5) = 5.733333 $ and $ v\[x_1\,x_2\]= frac(8.97 - 7.09, 1.95 - 1.65) = 6.266667 $ Therefore, the Newton interpolating polynomial is $ v\(x\)= 6.23 + 5.733333\(x - 1.5\)+ 1.185185\(x - 1.5\)\(x - 1.65\) $ Expanding: $ v\(x\)= 1.185185 x^2 + 2 x + 0.563333 $ with $v$ measured in millimetres.

Differentiate twice: $ frac(d v, d x) & = 2.370370 x + 2\
frac(d^2 v, d x^2) & = 2.370370\
 $ Because the interpolant is quadratic, the second derivative is constant. Therefore, at $x = 1.8 thin upright("m")$,

$ #box(stroke: black, inset: 3pt, [$ frac(d^2 v, d x^2) = 2.37037 med upright("mm")\/upright("m")^2 = 2.37037 times 10^(- 3) upright("m")^(- 1) $]) $

]
#heading(level: 1, numbering: none)[Question 2.]
<question-2.>
#block[
The beam equation is $ frac(d^2 v, d x^2) = - frac(M, E I) $ Rearranging for $E$: $ E = - frac(M, I\(d^2 v\/d x^2\)) $ Converting the quantities to SI units: $ M = - 21 med upright("kN") dot.op upright("m") = - 21 thin 000 med upright("N") dot.op upright("m") $ and $ I = 18.5 times 10^6 med upright("mm")^4 . $ Since $ 1 med upright("mm")^4 = 10^(- 12) med upright("m")^4 $ then $ I = 18.5 times 10^6 times 10^(- 12) = 1.85 times 10^(- 5) med upright("m")^4 $

Substitute into the equation: $ E = - frac(- 21 thin 000, \(1.85 times 10^(- 5)\)\(2.37037 times 10^(- 3)\)) $ Therefore, $ E = 4.78885 times 10^11 med upright("Pa") $ Thus, the estimated Young's modulus is $ #box(stroke: black, inset: 3pt, [$ E approx 4.79 times 10^11 med upright("Pa") = 479 med upright("GPa") $]) $

]
