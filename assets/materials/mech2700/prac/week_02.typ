#import "template.typ": sheet
#show: body => sheet(week: 2, body)

#heading(level: 1, numbering: none)[Question 1.]
<question-1.>
#block[
#block[
a. The correlation is $ k\(T\)= A T^B e^(C T) e^(D\/T)\, $ where $ A = 1.5531\,#h(2em) B = 0.8703\,#h(2em) C = - 12.4882 times 10^(- 4)\,#h(2em) D = 143.6 $ At $T = 100 K$, $ k\(100\) & = 1.5531\(100\)^0.8703 e^(\(- 12.4882 times 10^(- 4)\)\(100\)) e^(143.6\/100)\
 & = 317.11058019 med upright(W\/\(m K\)) $ Similarly, $ #box(stroke: black, inset: 3pt, [$ k\(100\) & = 317.11058019 med upright(W\/\(m K\))\
k\(200\) & = 249.53883084 med upright(W\/\(m K\))\
k\(300\) & = 246.72527927 med upright(W\/\(m K\)) $]) $

]
#block[
b. The polynomial has the form $ k\(T\)= a T^2 + b T + c $ Substituting the three known points gives $ 10000 a + 100 b + c & = 317.11058019\
40000 a + 200 b + c & = 249.53883084\
90000 a + 300 b + c & = 246.72527927 $ Subtracting the first equation from the second, $ 30000 a + 100 b = - 67.57174935 $ Subtracting the second equation from the third, $ 50000 a + 100 b = - 2.81355157 $ Subtracting these equations, $ 20000 a = 64.75819778 $ so $ a = 0.003237909889 $ Substituting this into the first reduced equation, $ 30000\(0.003237909889\)+ 100 b = - 67.57174935 $ which gives $ b = - 1.647090460 $ Finally, using the first original equation, $ 10000 a + 100 b + c = 317.11058019 $ giving $ c = 449.4405273 $ Therefore, $ k_(upright(i n t e r p))\(T\)= 0.003237909889 T^2 - 1.647090460 T + 449.4405273 $

]
#block[
c. $ k_(upright(i n t e r p))\(250\) & = 0.003237909889\(250\)^2 - 1.647090460\(250\)+ 449.4405273\
 & = 240.03728033 med upright(W\/\(m K\)) $ Thus, $ #box(stroke: black, inset: 3pt, [$ k_(upright(i n t e r p))\(250\)= 240.0373 med upright(W\/\(m K\)) $]) $

]
#block[
d. The exact value from the original correlation is $ k_(upright(e x a c t)) = 246.60191848 upright(W\/\(m K\)) $ Therefore, $ upright(e r r o r) & = lr(|frac(k_(upright(i n t e r p)) - k_(upright(e x a c t)), k_(upright(e x a c t)))|) times 100\
 & = lr(|frac(240.03728033 - 246.60191848, 246.60191848)|) times 100\
 & = 2.6620 % $ Thus, $ #box(stroke: black, inset: 3pt, [$ upright(P e r c e n t a g e med e r r o r) approx 2.66 % $]) $

]
]
