#import "template.typ": sheet, topic, rule

#show: body => sheet(
  "MECH2700",
  "Computational Engineering & Data Analysis",
  "",
  body,
)

#topic("Error & convergence")[$E_a=abs(x-hat(x))$ · $E_r=E_a/abs(x)$ · $E_%=100E_r$

$E(h) approx C h^p$, so $p approx ln(E_h/E_(h/2))/ln 2$

Halving $h$ reduces error by $2^p$

Stop when $abs(x_(k+1)-x_k) <= epsilon_a$ or $abs(x_(k+1)-x_k)/abs(x_(k+1)) <= epsilon_r$]

#topic("Interpolation")[$p_n(x)=sum_(i=0)^n y_i L_i(x)$

$L_i(x)=product_(j=0,j!=i)^n (x-x_j)/(x_i-x_j)$

$f(x)-p_n(x)=f^((n+1))(xi)/(n+1)! product_(i=0)^n(x-x_i)$

Newton form:
$p_n(x)=a_0+a_1(x-x_0)+dots+a_n product_(j=0)^(n-1)(x-x_j)$

$a_k=f[x_0,dots,x_k]$, with $f[x_i,x_j]=(f(x_j)-f(x_i))/(x_j-x_i)$]

#topic("Chebyshev interpolation")[$T_0=1$, $T_1=x$, $T_(n+1)=2 x T_n-T_(n-1)$

Roots on $[-1,1]$: $t_k=cos((2k-1)pi/(2n))$

Map to $[a,b]$: $x_k=(a+b)/2+(b-a)t_k/2$

Use Chebyshev nodes to reduce endpoint oscillation]

#topic("Finite differences")[$f'(x_i) approx (f_(i+1)-f_i)/h$ forward, $O(h)$

$f'(x_i) approx (f_i-f_(i-1))/h$ backward, $O(h)$

$f'(x_i) approx (f_(i+1)-f_(i-1))/(2h)$ central, $O(h^2)$

$f''(x_i) approx (f_(i+1)-2f_i+f_(i-1))/h^2$, $O(h^2)$

Boundary $O(h^2)$: $f'(x_0) approx (-3f_0+4f_1-f_2)/(2h)$]

#topic("Newton–Cotes")[$T_1=(b-a)(f(a)+f(b))/2$

Composite trapezoid, $h=(b-a)/n$:
$T_n=h[f_0/2+sum_(i=1)^(n-1)f_i+f_n/2]$

Composite Simpson $1/3$ ($n$ even):
$S_n=h/3[f_0+f_n+4sum_(i "odd")f_i+2sum_(i "even", i!=0,n)f_i]$

Simpson $3/8$ ($n$ multiple of 3): weights $1,3,3,2,dots,3,3,1$ and factor $3h/8$]

#topic("Gaussian quadrature")[$integral_a^b f(x)dif x=(b-a)/2 integral_(-1)^1 f((a+b)/2+(b-a)t/2)dif t$

$approx (b-a)/2 sum_i w_i f(x(t_i))$

2-point: $t=plus.minus 1/sqrt(3)$, $w=(1,1)$

3-point: $t=(-sqrt(3/5),0,sqrt(3/5))$, $w=(5/9,8/9,5/9)$

$n$ Gauss points are exact through degree $2n-1$]

#topic("Direct linear systems")[$A x=b$ · residual $r=b-A x$

Elimination: $m_(i k)=a_(i k)/a_(k k)$; row $i arrow$ row $i-m_(i k)$ row $k$

$A=L U$; solve $L y=b$, then $U x=y$

Forward: $y_i=(b_i-sum_(j<i)l_(i j)y_j)/l_(i i)$

Back: $x_i=(y_i-sum_(j>i)u_(i j)x_j)/u_(i i)$

Partial pivot on largest available $abs(a_(i k))$ before division]

#topic("Norms & conditioning")[$norm(x)_1=sum_i abs(x_i)$ · $norm(x)_2=sqrt(sum_i x_i^2)$ · $norm(x)_infinity=max_i abs(x_i)$

$norm(A)_infinity=max_i sum_j abs(a_(i j))$

$kappa(A)=norm(A)norm(A^(-1))$

$norm(delta x)/norm(x) <= kappa(A) norm(delta b)/norm(b)$ approximately]

#topic("Iterative linear systems")[$x_i^((k+1))=(b_i-sum_(j!=i)a_(i j)x_j^(*))/a_(i i)$

Jacobi: every $x_j^*=x_j^((k))$

Gauss–Seidel: use new values for $j<i$, old for $j>i$

Relaxation: $x^((k+1))=(1-omega)x^((k))+omega x_("GS")^((k+1))$, usually $0<omega<2$

Sufficient convergence: $abs(a_(i i))>sum_(j!=i)abs(a_(i j))$]

#topic("Least squares")[$S=sum_i(y_i-f(x_i))^2$

For $f(x)=sum_(j=0)^m a_j phi_j(x)$: $A a approx y$

Normal equations: $A^T A a=A^T y$

Line $y=a+b x$:
$b=(n sum x y-sum x sum y)/(n sum x^2-(sum x)^2)$

$a=bar(y)-b bar(x)$]

#topic("Bisection & fixed point")[$m_k=(a_k+b_k)/2$; retain the half with a sign change

After $n$ bisections: width $=(b-a)/2^n$

$n >= ceil(log_2((b-a)/epsilon))$ for width $<=epsilon$

Fixed point: $x_(k+1)=g(x_k)$; local convergence when $abs(g'(r))<1$]

#topic("Newton & secant roots")[$x_(k+1)=x_k-f(x_k)/f'(x_k)$ (quadratic near a simple root)

Secant:
$x_(k+1)=x_k-f(x_k)(x_k-x_(k-1))/(f(x_k)-f(x_(k-1)))$

Check bracket/sign, derivative size, residual and step; do not divide by a near-zero denominator]

#topic("Golden-section search")[$tau=(sqrt(5)-1)/2 approx 0.618$

$x_1=b-tau(b-a)$, $x_2=a+tau(b-a)$

Discard the side with the larger value for minimisation; reuse one function value

Interval width after $n$: $L_n=tau^n L_0$

Requires a unimodal objective on the bracket]

#topic("ODE setup & Euler")[$y'=f(t,y)$, $y(t_0)=y_0$, $t_(n+1)=t_n+h$

Euler: $y_(n+1)=y_n+h f(t_n,y_n)$; global $O(h)$

Second-order $y''=g(t,y,y')$: set $z_1=y$, $z_2=y'$; then $z_1'=z_2$, $z_2'=g(t,z_1,z_2)$]

#topic("RK2 & RK4")[$k_1=f(t_n,y_n)$, $k_2=f(t_n+alpha h,y_n+alpha h k_1)$

$y_(n+1)=y_n+h[(1-1/(2alpha))k_1+k_2/(2alpha)]$

$alpha=1$ gives Heun; $alpha=1/2$ gives midpoint

RK4: $k_1=f(t,y)$; $k_2=f(t+h/2,y+h k_1/2)$; $k_3=f(t+h/2,y+h k_2/2)$; $k_4=f(t+h,y+h k_3)$

$y_(n+1)=y_n+h(k_1+2k_2+2k_3+k_4)/6$; global $O(h^4)$]

#topic("Grid derivatives")[$x_i=i Delta x$, $t^n=n Delta t$, $u_i^n approx u(x_i,t^n)$

$u_t approx (u_i^(n+1)-u_i^n)/Delta t$

$u_x approx (u_i^n-u_(i-1)^n)/Delta x$ for right-going upwind

$u_(x x) approx (u_(i+1)^n-2u_i^n+u_(i-1)^n)/Delta x^2$]

#topic("Diffusion / heat")[$u_t=D u_(x x)$; $sigma=D Delta t/Delta x^2$

Explicit:
$u_i^(n+1)=sigma u_(i-1)^n+(1-2sigma)u_i^n+sigma u_(i+1)^n$

1D stability: $0<=sigma<=1/2$

Implicit:
$-sigma u_(i-1)^(n+1)+(1+2sigma)u_i^(n+1)-sigma u_(i+1)^(n+1)=u_i^n$]

#topic("Convection & waves")[$u_t+v u_x=0$

For $v>0$: $u_i^(n+1)=u_i^n-C(u_i^n-u_(i-1)^n)$

For $v<0$: $u_i^(n+1)=u_i^n-C(u_(i+1)^n-u_i^n)$

$C=v Delta t/Delta x$, $abs(C)<=1$

$u_(t t)=c^2u_(x x)$:
$u_i^(n+1)=2u_i^n-u_i^(n-1)+C^2(u_(i+1)^n-2u_i^n+u_(i-1)^n)$

2D adds $C_x^2(u_(i+1,j)^n-2u_(i,j)^n+u_(i-1,j)^n)+C_y^2(u_(i,j+1)^n-2u_(i,j)^n+u_(i,j-1)^n)$

1D CFL $abs(C)<=1$; 2D requires $C_x^2+C_y^2<=1$]

#topic("Elliptic / Laplace")[$u_(x x)+u_(y y)=0$

Equal grid spacing:
$u_(i,j)=(u_(i+1,j)+u_(i-1,j)+u_(i,j+1)+u_(i,j-1))/4$

Matrix row: centre $-4$, each interior neighbour $+1$; move known boundary terms to the RHS

Dirichlet gives $u$; Neumann gives a derivative and needs a one-sided/ghost-node relation]

#topic("Exam method")[- Write the continuous problem, then the discrete formula
- Keep old/new time levels separate; copy arrays before explicit updates
- Apply boundary values outside the interior loop
- State accuracy, convergence or CFL condition
- Verify with residual, bracket, units, symmetry or a refined step
- If the answer is unstable, first check sign, $h$ powers and overwritten values]
