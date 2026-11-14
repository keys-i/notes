---
title: Machine Learning Tutorials
slug: Tutorials
description: Machine learning tutorials with worked exercises on classification, regression, optimisation, neural networks, clustering, and dimensionality reduction.
---

# Machine Learning Tutorials

Use the same four moves for every tutorial problem:

1. name the input, target and unit of observation
2. state the model and objective before calculating
3. keep model selection separate from final testing
4. interpret the number in the language of the problem

## Worked example

You have 60 labelled cases for a binary classification task. Twelve cases are
locked away as the test set. Four-fold cross-validation on the remaining 48
cases gives these balanced accuracies:

| Fold | Logistic regression | Decision tree |
| --- | ---: | ---: |
| 1 | 0.75 | 0.83 |
| 2 | 0.83 | 0.75 |
| 3 | 0.79 | 0.88 |
| 4 | 0.81 | 0.79 |

The means are

$$
\bar a_{\text{logistic}}=\frac{0.75+0.83+0.79+0.81}{4}=0.795
$$

and

$$
\bar a_{\text{tree}}=\frac{0.83+0.75+0.88+0.79}{4}=0.8125.
$$

Choose the tree under this pre-declared metric, refit it on all 48 development
cases, and touch the test set once. Suppose its test results are
$TP=5$, $FN=1$, $FP=2$ and $TN=4$. Its balanced accuracy is

$$
\frac{1}{2}\left(\frac{TP}{TP+FN}+\frac{TN}{TN+FP}\right)
=\frac{1}{2}\left(\frac{5}{6}+\frac{4}{6}\right)=0.75.
$$

The test score is lower than the cross-validation mean. That is not a reason to
return to model selection: doing so would turn the test set into another
validation set. Report the result and discuss sample size and fold variation.

## Practice

A linear model has fold scores $0.72, 0.78, 0.76, 0.74$. A tree has fold scores
$0.68, 0.84, 0.70, 0.86$. Both use the same fixed folds and metric.

1. Calculate both means
2. Which model would a mean-only rule select?
3. What useful warning is hidden by comparing only the means?

<details>
<summary>Show answer</summary>

Both means are $0.75$, so a mean-only rule cannot choose between them. The tree
has much larger fold-to-fold variation: its scores span $0.18$, compared with
$0.06$ for the linear model. Inspect the fold composition and report the
variation rather than pretending the models are equivalent in stability.

</details>

## Next practice

Work through the hidden-answer item on each [topic page](../Lectures/index.md),
then use the [past papers](../PY/index.md) under a
time limit.
