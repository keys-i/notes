---
title: Unsupervised and Semi-supervised Learning
slug: Unsupervised learning
description: Understand clustering, k-means, dimensionality reduction, principal components and semi-supervised learning
wip: true
---

# Unsupervised and Semi-supervised Learning

## Choose the task

| Task | Output | Main choice |
| --- | --- | --- |
| Clustering | group assignment | representation, distance and number of groups |
| Dimensionality reduction | lower-dimensional coordinates | structure to preserve |
| Semi-supervised learning | predictions from labelled and unlabelled cases | assumption connecting labels to structure |

These methods expose structure under chosen assumptions; they do not discover a
unique set of true categories.

## K-means

K-means chooses assignments $c_i$ and centroids $\mu_1,\ldots,\mu_K$ to minimise

$$
J=\sum_{i=1}^{n}\left\lVert x_i-\mu_{c_i}\right\rVert_2^2.
$$

Repeat until assignments stop changing:

1. assign each case to its nearest centroid
2. replace each centroid with the mean of its assigned cases

K-means can converge to different local optima, so compare multiple starts.

## Principal component analysis

PCA centres the data and finds orthogonal directions of maximum variance. For
sample covariance matrix $S$, a principal direction $v$ satisfies

$$
Sv=\lambda v.
$$

Larger eigenvalues explain more variance. The projected coordinates are found by
dotting centred cases with the selected eigenvectors.

## Worked example — one-dimensional K-means

Run one-dimensional K-means on points $1,2,8,9$ with initial centroids $2$ and
$8$.

1. Assign each point to its nearest initial centroid

$$
C_1=\{1,2\},\qquad C_2=\{8,9\}.
$$

2. Replace each centroid with its cluster mean

$$
\mu_1=\frac{1+2}{2}=1.5,
\qquad
\mu_2=\frac{8+9}{2}=8.5.
$$

3. Assignments are unchanged on the next iteration, so calculate the objective

$$
(1-1.5)^2+(2-1.5)^2+(8-8.5)^2+(9-8.5)^2=1.
$$

!!! warning "Distance follows the representation"

    K-means assumes Euclidean distance and compact, mean-representable groups.
    Scale numeric features with different units, and do not apply Euclidean
    distance to identifiers or arbitrary category codes

## Practice

Run one K-means assignment and update for points $0,2,10,12$ with initial
centroids $0$ and $10$. Give the new centroids and the resulting within-cluster
sum of squares.

<details>
<summary>Show answer</summary>

The assignments are $\{0,2\}$ and $\{10,12\}$. Their means are
$\mu_1=1$ and $\mu_2=11$. The sum of squares is

$$
(0-1)^2+(2-1)^2+(10-11)^2+(12-11)^2=4.
$$

</details>

## Recall checklist

- separate K-means assignment and centroid-update steps
- calculate the objective after updating the centroids
- for PCA, keep centring, covariance, eigenvectors and projection distinct
- explain how scaling, $K$ or retained dimension changes the result

[Next: generative models](generative.md) · [Topic map](index.md#topic-map) ·
[Past papers](../PY/index.md)
