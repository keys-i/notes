#import "template.typ": sheet
#show: body => sheet(week: 5, body)

#heading(level: 1, numbering: none)[Question 1.]
<question-1.>
#block[
The combustion reaction is $ upright(C H)_4 + alpha upright(O)_2 + 4 alpha upright(N)_2 arrow.r upright(C O)_2 + 2 upright(H)_2 upright(O) + beta upright(N O) + gamma upright(N)_2 . $

Equating the number of oxygen atoms on each side, $ 2 alpha = 2 + 2 + beta . $ Therefore, $ #box(stroke: black, inset: 3pt, [$ 2 alpha - beta = 4 $]) . $

Equating the number of nitrogen atoms on each side, $ 2\(4 alpha\)= beta + 2 gamma . $ Therefore, $ #box(stroke: black, inset: 3pt, [$ 8 alpha - beta - 2 gamma = 0 $]) . $

]
#heading(level: 1, numbering: none)[Question 2.]
<question-2.>
#block[
The three equations are $ 2 alpha - beta & = 4\,\
8 alpha - beta - 2 gamma & = 0\,\
2 beta - gamma & = 0 $

Let $ upright(bold(x)) = mat(delim: "[", alpha; beta; gamma) $

The equations can be written as $ underbrace(mat(delim: "[", 2, - 1, 0; 8, - 1, - 2; 0, 2, - 1), upright(bold(A))) underbrace(mat(delim: "[", alpha; beta; gamma), upright(bold(x))) = underbrace(mat(delim: "[", 4; 0; 0), upright(bold(b))) $

Therefore, $ #box(stroke: black, inset: 3pt, [$ upright(bold(A)) = mat(delim: "[", 2, - 1, 0; 8, - 1, - 2; 0, 2, - 1)\,#h(2em) upright(bold(b)) = mat(delim: "[", 4; 0; 0) $]) $

]
