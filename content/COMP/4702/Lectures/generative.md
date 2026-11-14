---
title: Generative Models
slug: Generative models
description: Compare autoregressive, latent-variable and adversarial generative models through probability factorisation and worked examples
wip: true
---

# Generative Models

## What is being modelled?

| Model | Distribution | Typical use |
| --- | --- | --- |
| Discriminative classifier | $p(y\mid x)$ | predict a label from features |
| Generative classifier | $p(x\mid y)p(y)$ | classify and model class-conditioned data |
| Unconditional generator | $p(x)$ | score or sample observations |

A generative model can score observations, fill missing parts or sample new
cases. Evaluation must match the intended use.

## Main factorisations

An autoregressive model factorises a vector in an order:

$$
p(x_1,\ldots,x_d)=\prod_{j=1}^{d}p(x_j\mid x_1,\ldots,x_{j-1}).
$$

A latent-variable model introduces unobserved $z$:

$$
p(x)=\int p(x\mid z)p(z)\,dz.
$$

| Family | Training idea | Main trade-off |
| --- | --- | --- |
| Autoregressive | predict each part from earlier parts | explicit likelihood, sequential sampling |
| VAE | reconstruction plus latent regularisation | useful latent space, approximate likelihood |
| GAN | generator competes with discriminator | sharp samples, unstable training and no explicit likelihood |
| Diffusion | reverse a gradual noising process | stable training, many sampling steps |

## Worked example — autoregressive joint probability

Consider two binary variables with

$$
p(x_1=1)=0.6,
$$

$$
p(x_2=1\mid x_1=1)=0.8,
\qquad
p(x_2=1\mid x_1=0)=0.25.
$$

1. Multiply the first-variable probability by the matching conditional

$$
p(1,1)=(0.6)(0.8)=0.48,
\qquad
p(1,0)=(0.6)(0.2)=0.12,
$$

$$
p(0,1)=(0.4)(0.25)=0.10,
\qquad
p(0,0)=(0.4)(0.75)=0.30.
$$

2. Check that the four probabilities sum to one

3. Marginalise over $x_1$

$$
p(x_2=1)=0.48+0.10=0.58.
$$

To sample, draw $x_1$ first, then draw $x_2$ from the conditional selected by
$x_1$.

!!! warning "Plausible samples are not enough"

    Inspect diversity, held-out likelihood or its approximation, task performance
    and nearest training examples. Good-looking samples alone do not show that a
    model learned the full distribution or generalises

## Practice

Let $p(x_1=1)=0.7$, $p(x_2=1\mid x_1=1)=0.9$ and
$p(x_2=1\mid x_1=0)=0.2$. Calculate all four joint probabilities and
$p(x_2=1)$.

<details>
<summary>Show answer</summary>

$$
p(1,1)=(0.7)(0.9)=0.63,
\qquad
p(1,0)=(0.7)(0.1)=0.07,
$$

$$
p(0,1)=(0.3)(0.2)=0.06,
\qquad
p(0,0)=(0.3)(0.8)=0.24.
$$

They sum to one, and

$$
p(x_2=1)=0.63+0.06=0.69.
$$

</details>

## Recall checklist

- write the requested distribution before factorising it
- distinguish joint, conditional and marginal probabilities
- check that a discrete joint distribution sums to one
- compare model families by likelihood access, sampling, representation and training

[Return to evaluation](evaluation.md) · [Topic map](index.md#topic-map) ·
[Past papers](../PY/index.md)
