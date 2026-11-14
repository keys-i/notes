---
title: Evaluation and Experiments
slug: Evaluation
description: Design fair machine-learning experiments using suitable splits, metrics, baselines, calibration and error analysis
wip: true
---

# Evaluation and Experiments

## Split before choosing a metric

Evaluation checks the whole learning procedure, including preprocessing and
model selection. Choose the split from the data-generating process:

- random split when cases are exchangeable
- time split when future cases must stay in the future
- group or person split when related records must stay together

Write the metric and baseline before inspecting final test results.

## Classification metrics

For binary classification:

$$
\text{precision}=\frac{TP}{TP+FP},
\qquad
\text{recall}=\frac{TP}{TP+FN},
$$

$$
F_1=2\frac{\text{precision}\times\text{recall}}
{\text{precision}+\text{recall}},
\qquad
\text{specificity}=\frac{TN}{TN+FP}.
$$

| Metric | Focus |
| --- | --- |
| Accuracy | all correct decisions when classes and costs are balanced |
| Precision | how many predicted positives are correct |
| Recall | how many actual positives are recovered |
| Specificity | how many actual negatives are rejected |
| $F_1$ | balance of precision and recall |

For scored outputs, ranking, calibration or task-specific costs may matter more
than one fixed-threshold metric.

## Worked example — confusion matrix

A classifier gives $TP=30$, $FP=10$, $FN=20$ and $TN=40$

1. There are 100 cases, so

$$
\text{accuracy}=\frac{30+40}{100}=0.70.
$$

2. Calculate the positive-class metrics

$$
\text{precision}=\frac{30}{40}=0.75,
\qquad
\text{recall}=\frac{30}{50}=0.60,
$$

$$
F_1=2\frac{(0.75)(0.60)}{0.75+0.60}\approx0.667.
$$

3. Specificity is $40/(40+10)=0.80$

The model rejects negatives better than it recovers positives. If missed
positives are costly, inspect recall across thresholds rather than relying on
accuracy.

!!! warning "Fit preprocessing inside each fold"

    Fit scaling, imputation, feature selection and dimensionality reduction on
    each training fold, then transform its validation fold. Fitting once on all
    data makes validation results too favourable

## Practice

A model gives $TP=18$, $FP=2$, $FN=6$ and $TN=24$. Calculate accuracy,
precision, recall, $F_1$ and specificity.

<details>
<summary>Show answer</summary>

There are 50 cases:

$$
\text{accuracy}=\frac{18+24}{50}=0.84,
\qquad
\text{precision}=\frac{18}{20}=0.90,
$$

$$
\text{recall}=\frac{18}{24}=0.75,
\qquad
F_1=2\frac{(0.90)(0.75)}{0.90+0.75}\approx0.818,
$$

$$
\text{specificity}=\frac{24}{26}\approx0.923.
$$

</details>

## Experiment checklist

- define the unit of splitting and prevent related cases crossing the boundary
- fit every learned transformation on training data only
- compare with a useful baseline under the same conditions
- report the metric tied to the stated mistake cost
- keep the test set untouched until the procedure is fixed

[Next: unsupervised learning](unsupervised.md) ·
[Worked model-selection example](../Tutorial/index.md#worked-example) ·
[Past papers](../PY/index.md)
