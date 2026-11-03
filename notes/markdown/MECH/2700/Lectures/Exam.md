---
title: MECH2700 Exam Guide
slug: Exam
---

# MECH2700 Exam Guide

## What Past Papers Emphasise

The 2021–2025 papers repeatedly test whether a numerical method can be selected,
applied and checked rather than recalled in isolation

| Topic                          | Recurring question styles                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| interpolation                  | construct or evaluate Lagrange, Newton or Chebyshev forms and discuss error               |
| differentiation and quadrature | select a formula, identify order and calculate a numerical estimate                       |
| linear systems                 | perform LU, elimination or Jacobi steps and judge convergence                             |
| nonlinear equations            | perform bisection or Newton iterations and state stopping logic                           |
| ODEs                           | advance Euler or Runge-Kutta methods and translate a physical model into first-order form |
| least squares and optimisation | form normal equations or bracket and minimise a scalar objective                          |
| parabolic PDEs                 | derive or code an explicit heat update and check stability                                |
| hyperbolic PDEs                | choose upwinding or implement a wave update with the correct CFL condition                |
| elliptic PDEs                  | assemble a finite-difference linear system and apply boundary equations                   |

### Paper-by-Paper Map

| Paper | Main extended-method themes                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------- |
| 2021  | composite Simpson rule, Newton root finding, Euler/RK2 and Python implementation                          |
| 2022  | elliptic finite differences and linear solve, differentiation, parabolic PDEs and Chebyshev interpolation |
| 2023  | linear systems and Jacobi, ODEs, one-way wave equation and Gaussian quadrature                            |
| 2024  | ODEs, interpolation, parabolic PDE implementation, least squares and bisection-style optimisation         |
| 2025  | interpolation, LU factorisation, least squares/Newton and a two-dimensional wave implementation           |

This pattern makes ODEs, interpolation, linear algebra and PDE implementation
especially high-value revision areas

## Formula Selection Map

| If the question asks for                       | Start with                          |
| ---------------------------------------------- | ----------------------------------- |
| a value between exact data points              | interpolation                       |
| a trend through noisy or abundant data         | least squares                       |
| a derivative from tabulated values             | finite differences                  |
| an integral from values or a callable function | Newton-Cotes or Gaussian quadrature |
| $x$ such that $f(x)=0$                         | root finding                        |
| $x$ that minimises $f(x)$                      | optimisation                        |
| $A\mathbf x=\mathbf b$ once                    | direct linear solve                 |
| a large sparse $A\mathbf x=\mathbf b$          | iterative linear solve              |
| an initial-value differential equation         | ODE time stepping                   |
| diffusion forward in time                      | parabolic scheme                    |
| transport or waves                             | hyperbolic scheme                   |
| a steady field from boundary values            | elliptic scheme                     |

## Universal Numerical Workflow

1. write the mathematical problem and the required output
2. list known values, units and the valid domain
3. choose a method whose assumptions match the problem
4. write the formula symbolically before inserting numbers
5. keep guard digits during intermediate calculations
6. apply the stated stopping or stability condition
7. verify the result using residuals, bounds, units or an independent relation
8. report the answer with sensible precision and a short interpretation

## High-Yield Checks

### Floating-Point and Error

- distinguish absolute, relative and percentage error
- machine precision limits representation, while truncation error comes from the
  method
- subtracting nearly equal values can cause catastrophic cancellation
- a smaller step is not always better when round-off is amplified

### Interpolation

- $N$ points determine a polynomial of degree at most $N-1$
- Lagrange basis functions satisfy $L_j(x_i)=\delta_{ij}$
- Newton divided differences support incremental construction
- interpolation is exact at each data point
- high-degree equally spaced interpolation may oscillate near boundaries

### Numerical Differentiation

- central differences usually gain one order over the comparable one-sided formula
- divide first derivatives by $h$ and second derivatives by $h^2$
- choose one-sided formulas at boundaries
- differentiation magnifies noise

### Quadrature

- trapezoidal rule integrates degree one exactly
- Simpson's $1/3$ rule needs an even number of panels and integrates degree
  three exactly
- Simpson's $3/8$ rule uses panel counts divisible by three
- an $n$-point Gaussian rule integrates degree $2n-1$ exactly
- map a general interval to $[-1,1]$ before using standard Gaussian nodes and weights

### Linear Systems

- pivot before dividing by a small or zero diagonal entry
- distinguish $LU$ factorisation from forward and back substitution
- verify with the residual $\mathbf r=\mathbf b-A\mathbf x$
- Jacobi uses only old-iteration values
- Gauss-Seidel uses updated values as soon as available
- diagonal dominance is sufficient, not necessary, for convergence

### ODEs

- convert higher-order equations into a first-order state system
- Euler has global error $O(h)$
- midpoint or modified Euler methods have global error $O(h^2)$
- classical RK4 has global error $O(h^4)$
- calculate all RK stages from the same starting state
- stability and accuracy impose different step-size limits

### Roots and Optimisation

- bisection requires a continuous function and a sign-changing bracket
- Newton is fast near a simple root but can fail with a poor initial guess or
  small derivative
- the secant method avoids explicit derivatives
- golden-section search requires a unimodal objective interval
- a root bracket and a minimum bracket are different conditions

### PDEs

- diffusion: $\sigma=D\Delta t/\Delta x^2\le1/2$ in one-dimensional explicit stepping
- convection: choose the stencil from the sign of velocity and require
  $|v|\Delta t/\Delta x\le1$
- 1D wave: $c\Delta t/\Delta x\le1$
- 2D wave: $C_x^2+C_y^2\le1$
- elliptic problems use boundary equations and a simultaneous linear solve or
  converged iteration

## Coding Questions

Past papers often provide incomplete numerical code or ask for a short implementation

Before filling a blank, determine

- which indices are old and new
- whether the scheme permits in-place updates
- the valid loop bounds
- where boundary values are assigned
- which arrays must be copied or rotated
- whether a stability or convergence check is missing

### Safe Explicit-Time Pattern

```python
for step in range(number_of_steps):
    old = values.copy()
    for i in range(1, number_of_nodes - 1):
        values[i] = update(old, i)
    apply_boundaries(values, step + 1)
```

### Safe Iterative-Linear Pattern

```python
for iteration in range(maximum_iterations):
    previous = solution.copy()
    update(solution, previous)
    if max(abs(solution - previous)) < tolerance:
        break
```

Know whether `update` is Jacobi, which reads `previous`, or Gauss-Seidel, which
intentionally reads newly updated entries from `solution`

## How to Show Working for Marks

For every numerical iteration, show

1. the formula used
2. the substituted values
3. the new estimate
4. the error, residual, bracket or stopping quantity

For a finite-difference derivation, show

1. the original PDE
2. each derivative approximation
3. the substituted discrete equation
4. the rearranged update or matrix coefficients
5. the boundary treatment
6. the stability condition where relevant

## Final Ten-Minute Check

- every requested part has an answer
- units appear on dimensional results
- intervals and inequality directions are correct
- iteration numbers and superscripts are consistent
- matrices and vectors have compatible dimensions
- no explicit scheme has used newly updated interior values accidentally
- PDE boundary nodes were treated separately
- the numerical result is physically plausible
- significant figures match the data and method

> [!TIP] If an answer looks wrong
>
> Check signs, powers of $h$, index direction, degrees versus number of points,
> radians versus degrees, and whether an old value was overwritten too early
