---
title: Linear Models
slug: Linear models
description: Understand linear regression, logistic classification, loss functions and gradient updates through worked calculations
wip: true
---

# Linear Models

## Score, output and loss

For $d$ features,

$$
z=w^\top x+b.
$$

| Task | Output | Typical loss |
| --- | --- | --- |
| Linear regression | $\hat y=z$ | squared loss |
| Logistic classification | $p(y=1\mid x)=\sigma(z)$ | binary cross-entropy |

A model is linear in its parameters even when its inputs include engineered
features such as $x^2$ or $x_1x_2$.

Logistic regression maps the score to a probability:

$$
p(y=1\mid x)=\sigma(z)=\frac{1}{1+e^{-z}}.
$$

With binary cross-entropy

$$
\ell(p,y)=-y\log p-(1-y)\log(1-p),
$$

the one-case weight gradient is $(p-y)x$. Keep the score $z$, probability $p$,
loss $\ell$ and parameter update separate.

```plot
{
  "title": "Logistic score to probability",
  "description": "The logistic function maps scores from minus four to four onto probabilities between zero and one, crossing one half at a score of zero",
  "data": [
    {
      "type": "scatter",
      "mode": "lines+markers",
      "name": "probability",
      "x": [-4, -3, -2, -1, 0, 1, 2, 3, 4],
      "y": [0.018, 0.047, 0.119, 0.269, 0.5, 0.731, 0.881, 0.953, 0.982]
    }
  ],
  "layout": {
    "xaxis": {"title": "linear score z"},
    "yaxis": {"title": "probability of class 1", "range": [0, 1]}
  }
}
```

Equal score changes matter most near zero and barely affect an already extreme
probability.

## Worked example — one logistic update

Let

$$
x=(2,1),\qquad w=(-1,2),\qquad b=0.5,\qquad y=1.
$$

1. Compute the score and probability

$$
z=(-1)(2)+(2)(1)+0.5=0.5,
$$

$$
p=\sigma(0.5)\approx0.622.
$$

2. Threshold at $0.5$, so the predicted class is $1$

3. Compute the gradient for $\eta=0.1$

$$
\nabla_w\ell=(p-y)x=(-0.378)(2,1)=(-0.756,-0.378),
$$

4. Update the weights

$$
w_{\text{new}}=w-0.1\nabla_w\ell
=(-0.9244,2.0378).
$$

The intercept gradient is $p-y=-0.378$, so $b_{\text{new}}=0.5378$. Both
changes increase the score for this positive case.

!!! warning "Coefficient size is scale-dependent"

    Feature units, scaling, correlation and regularisation all affect coefficient
    size. A larger coefficient does not automatically mean a more important feature

## Practice

For $x=(1,-2)$, $w=(0.5,-1)$ and $b=-0.5$, calculate the logistic score,
probability and class at threshold $0.5$.

<details>
<summary>Show answer</summary>

$$
z=(0.5)(1)+(-1)(-2)-0.5=2.
$$

Therefore

$$
p=\sigma(2)=\frac{1}{1+e^{-2}}\approx0.881,
$$

and the predicted class is $1$.

</details>

## Recall checklist

- calculate $z$ before applying the link function
- distinguish a probability from a thresholded class
- use $(p-y)x$ for the one-case logistic weight gradient
- check feature scaling before interpreting coefficients

[Next: trees and ensembles](trees.md) · [Topic map](index.md#topic-map) ·
[Past papers](../PY/index.md)
