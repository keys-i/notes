---
title: Neural Networks and Deep Learning
slug: Neural networks
description: Trace neural-network forward passes, activations, losses and backpropagation while understanding representation learning
wip: true
---

# Neural Networks and Deep Learning

## Forward pass

A layer forms a weighted sum, then applies a nonlinear activation. Early layers
can learn reusable features; later layers combine them for the target task.

For layer $l$,

$$
z^{(l)}=W^{(l)}h^{(l-1)}+b^{(l)},
\qquad
h^{(l)}=\phi\left(z^{(l)}\right).
$$

Without $\phi$, stacked layers collapse into one linear transformation. Depth is
useful only when nonlinear operations separate the layers.

## Backpropagation

Backpropagation applies the chain rule from the scalar loss towards the inputs.
For $w\rightarrow z\rightarrow h\rightarrow L$,

$$
\frac{\partial L}{\partial w}
=\frac{\partial L}{\partial h}
 \frac{\partial h}{\partial z}
 \frac{\partial z}{\partial w}.
$$

For ReLU, $\phi(z)=\max(0,z)$ and $\phi'(z)$ is $0$ for negative inputs and $1$
for positive inputs. A convention is chosen at zero.

## Worked example — inactive ReLU

Consider one hidden ReLU unit:

$$
x=(1,2),\quad w=(0.5,-1),\quad b=1.
$$

1. Compute the hidden unit

$$
z=w^\top x+b=0.5-2+1=-0.5,
\qquad h=\max(0,-0.5)=0.
$$

2. Compute the output and half-squared loss

$$
L=\frac{1}{2}(\hat y-y)^2
=\frac{1}{2}(-0.7)^2=0.245.
$$

3. Since $z<0$, the ReLU derivative and hidden-weight gradient are zero

4. The output-bias gradient is $\hat y-y=-0.7$, so $\eta=0.1$ updates the bias
   from $0.3$ to $0.37$

The loss is non-zero, but this case cannot update the inactive hidden unit.

## Training ingredients

An architecture is not a complete training procedure. Record the initialisation,
loss, optimiser, learning-rate schedule, batch size, regularisation and stopping
rule.

## Practice

Let $x=(2,1)$, $w=(1,-1)$ and $b=0$, so one ReLU unit feeds an output
$\hat y=0.5h$ with target $y=1$. Use half-squared loss. Calculate $h$, $\hat y$,
$L$, $\partial L/\partial w$ and $\partial L/\partial b$.

<details>
<summary>Show answer</summary>

The hidden pre-activation is $z=2-1=1$, so $h=1$. Then $\hat y=0.5$ and

$$
L=\frac{1}{2}(0.5-1)^2=0.125.
$$

The derivative at the output is $\hat y-y=-0.5$. Passing it through the output
weight and the active ReLU gives

$$
\frac{\partial L}{\partial z}=(-0.5)(0.5)(1)=-0.25.
$$

Therefore

$$
\frac{\partial L}{\partial w}=(-0.25)x=(-0.5,-0.25),
\qquad
\frac{\partial L}{\partial b}=-0.25.
$$

</details>

## Recall checklist

- write the shape and value at each forward-pass stage
- start backpropagation at the scalar loss
- multiply one local derivative at a time
- check whether the activation passes or blocks the gradient

[Next: evaluation and experiments](evaluation.md) ·
[Topic map](index.md#topic-map) ·
[Past papers](../PY/index.md)
