#import "handout.typ": handout, result
#show: handout.with(title: "Week 2")

= Question 1

== a

The correlation is

$ k(T) = A T^B e^(C T) e^(D / T) $

with

$ A = 1.5531, quad B = 0.8703, quad C = -12.4882 times 10^(-4), quad D = 143.6 $

At $T = 100 upright("K")$,

$
  k(100)
  &= 1.5531(100)^0.8703 e^((-12.4882 times 10^(-4))(100)) e^(143.6 / 100) \
  &= 317.11058019 upright(" W/(m K)")
$

Repeating the calculation at the other temperatures gives

#align(center)[
  #result[$
    k(100) &= 317.11058019 upright(" W/(m K)") \
    k(200) &= 249.53883084 upright(" W/(m K)") \
    k(300) &= 246.72527927 upright(" W/(m K)")
  $]
]

== b

Use a quadratic of the form

$ k(T) = a T^2 + b T + c $

The three known points give

$
  10 000a + 100b + c &= 317.11058019 \
  40 000a + 200b + c &= 249.53883084 \
  90 000a + 300b + c &= 246.72527927
$

Subtracting adjacent equations leaves

$
  30 000a + 100b &= -67.57174935 \
  50 000a + 100b &= -2.81355157
$

Their difference gives $20 000a = 64.75819778$, so
$a = 0.003237909889$. Substitution back into the system gives
$b = -1.647090460$ and $c = 449.4405273$

The interpolating polynomial is

$ k_("interp")(T) = 0.003237909889 T^2 - 1.647090460 T + 449.4405273 $

== c

$
  k_("interp")(250)
  &= 0.003237909889(250)^2 - 1.647090460(250) + 449.4405273 \
  &= 240.03728033 upright(" W/(m K)")
$

#align(center)[
  #result[$k_("interp")(250) = 240.0373 upright(" W/(m K)")$]
]

== d

The original correlation gives

$ k_("exact") = 246.60191848 upright(" W/(m K)") $

Using $abs((k_("interp") - k_("exact")) / k_("exact")) times 100$, the
percentage error is #result[$2.6620 "%" approx 2.66 "%"$]
