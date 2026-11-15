#import "template.typ": sheet
#show: body => sheet(week: 1, body)

#heading(level: 1, numbering: none)[Question 1.]
<question-1.>
#block[
Divide repeatedly by $2$, keeping track of the remainders and then reading remainders bottoms-up.

#block[
\1. $ 17 / 2 & = 8 upright(" rem ") 1\
8 / 2 & = 4 upright(" rem ") 0\
4 / 2 & = 2 upright(" rem ") 0\
2 / 2 & = 1 upright(" rem ") 0\
1 / 2 & = 0 upright(" rem ") 1 $ It gives us, $#box(stroke: black, inset: 3pt, [$ 17_10 =\(10001\)_2 $])$

]
#block[
\2. $ 227 / 2 & = 113 upright(" rem ") 1\
113 / 2 & = 56 upright(" rem ") 1\
56 / 2 & = 28 upright(" rem ") 0\
28 / 2 & = 14 upright(" rem ") 0\
14 / 2 & = 7 upright(" rem ") 0\
7 / 2 & = 3 upright(" rem ") 1\
3 / 2 & = 1 upright(" rem ") 1\
1 / 2 & = 0 upright(" rem ") 1 $ Therefore, $#box(stroke: black, inset: 3pt, [$ 227_10 =\(11100011\)_2 $])$

]
#block[
\3. First, convert the whole number part: $ 55 / 2 & = 27 upright(" rem ") 1\
27 / 2 & = 13 upright(" rem ") 1\
13 / 2 & = 6 upright(" rem ") 1\
6 / 2 & = 3 upright(" rem ") 0\
3 / 2 & = 1 upright(" rem ") 1\
1 / 2 & = 0 upright(" rem ") 1 $ Hence, $#box(stroke: black, inset: 3pt, [$ 55_10 =\(110111\)_2 $])$ For the fractional part: $ 0.4 times 2 & = 0.8 &  & arrow.r.double 0\
0.8 times 2 & = 1.6 &  & arrow.r.double 1\
0.6 times 2 & = 1.2 &  & arrow.r.double 1\
0.2 times 2 & = 0.4 &  & arrow.r.double 0 $ which gives, $0.4_10 =\(0 . overline(0110)\)_2$ \ \ Therefore, $#box(stroke: black, inset: 3pt, [$ 55.4_10 =\(110111 . overline(0110)\)_2 $])$

]
]
#heading(level: 1, numbering: none)[Question 2.]
<question-2.>
#block[
Each digit is multiplied by its corresponding power of $2$.

#block[
\1. $ \(1010101\)_2 & = 1\(2^6\)+ 0\(2^5\)+ 1\(2^4\)+ 0\(2^3\)+ 1\(2^2\)+ 0\(2^1\)+ 1\(2^0\)\
 & = 64 + 16 + 4 + 1\
 & = 85 $ Hence, $#box(stroke: black, inset: 3pt, [$ \(1010101\)_2 = 85_10 $])$

]
#block[
\2. For whole number part, $ \(11\)_2 = 1\(2^1\)+ 1\(2^0\)= 3 $ For fractional part, $ \(0.101010 dots.h\)_2 = 1 / 2 + 1 / 2^3 + 1 / 2^5 + dots.h.c $ The sum of this GP is $2 / 3$ \ \ Therefore, $ \(11 . overline(10)\)_2 & = 3 + 2 / 3\
 & = 11 / 3\
 & =\(3 . overline(6)\)_10 $ Hence, $#box(stroke: black, inset: 3pt, [$ \(11 . overline(10)\)_2 = 3 . overline(6)_10 $])$

]
]
#heading(level: 1, numbering: none)[Question 3.]
<question-3.>
#block[
#block[
\1. The 32 bits are divided as follows: $ #box(stroke: black, inset: 3pt, [$ 1 upright(" sign bit") thick + thick 8 upright(" exponent bits") thick + thick 23 upright(" mantissa bits") $]) $ The sign bit determines whether the number is positive or negative. The exponent controls the scale of the number, while the mantissa stores its significant digits. For normalised values, the leading $1$ is implied, giving effectively $24$ bits of precision.

]
#block[
\2. Machine epsilon, $ epsilon_m approx 1.19 times 10^(- 7) $ is the smallest value such that $ 1 + epsilon_m > 1 $ can be represented as a different single-precision floating-point number. It means single precision provides roughly $7$ significant decimal digits. \ \ This matters because each calculation may introduce a small rounding error. During many stress-analysis iterations, these errors can accumulate or affect whether the solution appears to converge. The engineer should therefore avoid using a convergence tolerance smaller than the available floating-point precision.

]
#block[
\3. The most likely explanation is that decimal values such as $0.3$ cannot be represented exactly in binary floating-point. The two formulas may therefore produce slightly different stored values due to rounding, even though both are displayed as $0.3000$. \ \

For example, $a = 0.30000000000000004\,#h(2em) b = 0.29999999999999999$

Since `a == b` compares the exact stored values, the condition evaluates as false. A tolerance should be used instead: $ \|a - b\|< epsilon $

]
]
