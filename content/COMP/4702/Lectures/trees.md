---
title: Decision Trees and Ensembles
slug: Trees and ensembles
description: Learn decision-tree splits, impurity, pruning, bagging, random forests and boosting through worked examples
wip: true
---

# Decision Trees and Ensembles

## Split mechanics

A decision tree repeatedly splits cases into more target-consistent groups. A
leaf predicts from the training cases that reach it. Later splits depend on
earlier ones, so trees capture feature interactions without defining them first.

For a classification node with class proportions $p_1,\ldots,p_K$, Gini
impurity is

$$
G=1-\sum_{k=1}^{K}p_k^2.
$$

For a candidate split into left and right children, the weighted impurity is

$$
G_{\text{split}}=\frac{n_L}{n}G_L+\frac{n_R}{n}G_R.
$$

A greedy tree selects the largest impurity decrease
$G_{\text{parent}}-G_{\text{split}}$. Regression trees usually replace class
impurity with squared deviation from the leaf mean.

## Controlling variance

| Method | Main idea | Effect |
| --- | --- | --- |
| Pruning or depth limits | restrict one tree | less variance, more bias |
| Bagging | average bootstrap-fitted trees | less variance |
| Random forest | bagging plus feature subsampling | less correlated trees |
| Boosting | add weak learners to correct current errors | stronger fit, sensitive to tuning |

## Worked example — choose a split

Six cases are ordered by study hours:

| Hours | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Pass | no | no | no | yes | yes | yes |

1. Root proportions are $(0.5,0.5)$

$$
G_{\text{root}}=1-0.5^2-0.5^2=0.5.
$$

2. The split $\text{hours}<3.5$ sends three negatives left and three positives right

$$
G_L=G_R=0,
$$

3. Weighted impurity is $0$, so the Gini decrease is $0.5$

The split is perfect on this sample only. A different cohort may not separate at
the same threshold.

!!! warning "Pure leaves can still overfit"

    A fully grown tree can memorise noise, rare values or identifiers. Use
    validation, minimum leaf sizes, pruning or an ensemble, and exclude identifiers

## Practice

A balanced node contains labels $[0,0,1,1]$. A candidate split places
$[0,0,1]$ on the left and $[1]$ on the right. Calculate the parent impurity,
weighted child impurity and Gini decrease.

<details>
<summary>Show answer</summary>

The parent impurity is $0.5$. The left child has proportions $(2/3,1/3)$:

$$
G_L=1-\left(\frac{2}{3}\right)^2-\left(\frac{1}{3}\right)^2
=\frac{4}{9}.
$$

The right child is pure, so $G_R=0$. The weighted impurity is

$$
\frac{3}{4}\frac{4}{9}+\frac{1}{4}(0)=\frac{1}{3},
$$

and the decrease is

$$
\frac{1}{2}-\frac{1}{3}=\frac{1}{6}.
$$

</details>

## Recall checklist

- calculate parent impurity before child impurity
- weight each child by its share of the cases
- compare splits by impurity decrease, not child purity alone
- distinguish pruning, bagging, random forests and boosting

[Next: neural networks](neural.md) · [Topic map](index.md#topic-map) ·
[Past papers](../PY/index.md)
