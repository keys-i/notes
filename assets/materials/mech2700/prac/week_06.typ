#import "handout.typ": handout, result
#show: handout.with(title: "Week 6")

= Question 1

Rewrite Equations (2)–(4) in a form suitable for Jacobi iteration

The discretised heat equations are

$
  -k ((T_L - 2 T_0 + T_1) / (Delta x^2)) &= q \
  -k ((T_0 - 2 T_1 + T_2) / (Delta x^2)) &= q \
  -k ((T_1 - 2 T_2 + T_R) / (Delta x^2)) &= q
$

Let

$ C = q Delta x^2 / k $

For $k = 170$, $q = 4 times 10^5$, and $Delta x = 0.1$,

$ C = ((4 times 10^5)(0.1)^2) / 170 = 400 / 17 approx 23.5294 upright(" K") $

Multiplying by $-Delta x^2 / k$ leaves

$
  T_L - 2 T_0 + T_1 &= -C \
  T_0 - 2 T_1 + T_2 &= -C \
  T_1 - 2 T_2 + T_R &= -C
$

Now isolate one unknown in each row:

$
  T_0 &= (T_L + T_1 + C) / 2 \
  T_1 &= (T_0 + T_2 + C) / 2 \
  T_2 &= (T_1 + T_R + C) / 2
$

Using values from iteration $n$ on the right-hand side gives the Jacobi update

#align(center)[
  #result[$
    T_0^(n+1) &= (T_L + T_1^n + C) / 2 \
    T_1^(n+1) &= (T_0^n + T_2^n + C) / 2 \
    T_2^(n+1) &= (T_1^n + T_R + C) / 2
  $]
]

After substituting the boundary temperatures and $C$,

#align(center)[
  #text(size: 10pt)[
    #result[$
      T_0^(n+1) &= 161.7647 + 0.5 T_1^n \
      T_1^(n+1) &= 11.7647 + 0.5 T_0^n + 0.5 T_2^n \
      T_2^(n+1) &= 386.7647 + 0.5 T_1^n
    $]
  ]
]
