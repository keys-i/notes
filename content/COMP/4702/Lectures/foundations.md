---
title: Machine Learning Foundations
slug: Foundations
description: Frame machine-learning problems through data, models, loss, optimisation, regularisation and generalisation
wip: true
---

# Machine Learning Foundations

## Frame the problem

| Part | Question to answer |
| --- | --- |
| Data | What does one case contain, and how was it sampled? |
| Target | What must be predicted or discovered? |
| Model | Which rules may the learner choose? |
| Loss | What makes one prediction worse than another? |
| Evaluation | How will performance on unseen cases be checked? |

Machine learning fits a rule from examples. The goal is not low training loss;
it is useful behaviour after the training sample is gone.

## Objective and optimisation

For training pairs $(x_i,y_i)$, a model $f_\theta$ and loss $\ell$, empirical
risk minimisation chooses

$$
\hat\theta=\arg\min_\theta
\frac{1}{n}\sum_{i=1}^{n}\ell\bigl(f_\theta(x_i),y_i\bigr)
+\lambda\Omega(\theta).
$$

The data term rewards fit. The regulariser $\Omega(\theta)$ prefers properties
such as smaller weights or a simpler tree. The coefficient $\lambda$ controls
the trade-off.

When gradients are available, a basic update is

$$
\theta_{t+1}=\theta_t-\eta\nabla_\theta L(\theta_t),
$$

where $\eta$ is the learning rate. Optimising the stated loss perfectly can
still fail when the data or objective does not match the real task.

## Data split and generalisation

- **Training set:** fit parameters
- **Validation set or cross-validation folds:** choose features, models and settings
- **Test set:** run once after those choices are fixed
- **Inductive bias:** assumptions that favour some unseen predictions
- **Generalisation:** performance on cases that did not fit or select the model

## Worked example — best constant predictor

Suppose the only allowed model is a constant prediction $f_c(x)=c$ and the
targets are $1,2,6$. Under mean squared error,

$$
L(c)=\frac{1}{3}\left[(1-c)^2+(2-c)^2+(6-c)^2\right].
$$

1. Differentiate and set the result to zero

$$
\frac{dL}{dc}=\frac{2}{3}\left[(c-1)+(c-2)+(c-6)\right]=0,
$$

2. Solve $3c-9=0$, giving $c=3$

3. Substitute the result

$$
L(3)=\frac{4+1+9}{3}=\frac{14}{3}.
$$

The mean is the best constant predictor for squared loss. It is only the best
member of this restricted model family, not necessarily a useful model.

!!! warning "Keep the test set separate"

    Choosing features, thresholds, architectures or hyperparameters from test
    results transfers information into model selection and makes the final score
    too optimistic

## Practice

For targets $2,4,9,9$, find the constant prediction that minimises mean squared
error and calculate that minimum error.

<details>
<summary>Show answer</summary>

The best constant is the mean,

$$
c=\frac{2+4+9+9}{4}=6.
$$

The minimum mean squared error is

$$
\frac{(2-6)^2+(4-6)^2+(9-6)^2+(9-6)^2}{4}
=\frac{16+4+9+9}{4}=9.5.
$$

</details>

## Recall checklist

- identify the data, target, model family and loss before calculating
- separate parameter fitting, model selection and final testing
- distinguish optimisation from generalisation
- state what the regulariser prefers and what $\lambda$ controls

[Next: linear models](linear.md) · [Topic map](index.md#topic-map) ·
[Past papers](../PY/index.md)
