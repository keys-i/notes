---
title: Machine Learning Lecture Notes
slug: Lectures
description: Machine learning lecture notes on classification, regression, optimisation, neural networks, deep learning, clustering, dimensionality reduction, and generative models.
---

# Machine Learning Lecture Notes

The notes are ordered around the decisions you make in a real machine-learning
problem: define the task, choose a model, fit it, test it, then explain what the
result means.

## Topic map

| Topic | Main question | You should be able to |
| --- | --- | --- |
| [Foundations](foundations.md) | What exactly is being learned? | State the data, model, loss and evaluation plan |
| [Linear models](linear.md) | How does a weighted score become a prediction? | Calculate regression and logistic predictions and updates |
| [Trees and ensembles](trees.md) | How can repeated decisions partition the input space? | Calculate split quality and explain variance control |
| [Neural networks](neural.md) | How do layers learn useful representations? | Trace a forward pass and a small backpropagation step |
| [Evaluation](evaluation.md) | How do we know a model will work on new data? | Choose a split and metric without leaking information |
| [Unsupervised learning](unsupervised.md) | What structure exists without labels? | Run a clustering step and explain dimensionality reduction |
| [Generative models](generative.md) | How can a model represent or create data? | Factorise a distribution and compare model families |

## How the ideas connect

A model family supplies candidate functions. A loss says which errors matter.
An optimisation algorithm searches for parameters. Regularisation and model
selection control how closely the fit follows the training sample. Evaluation
then asks whether the whole procedure transfers to unseen cases.

This same loop holds for a line, a tree, a neural network, a clustering method
or a generative model. The formulas change; the questions about data,
assumptions and testing do not.

## Misconceptions

- **Training accuracy measures success:** it only measures fit to data the model
  has already seen
- **A more flexible model is always better:** flexibility can lower training
  error while increasing unseen error
- **Optimisation and learning are the same:** optimisation finds parameters for
  a chosen objective; learning also depends on the data, representation and
  evaluation procedure
- **One metric tells the whole story:** the useful metric follows the cost of
  false positives, false negatives, ranking errors or poorly calibrated scores
- **Unsupervised output discovers the true groups:** clusters and components are
  summaries created under particular distance and representation choices

## How to use a topic page

Read the plain-language model first. Rework the numerical example without
looking, then open the practice answer. Finish by explaining the common mistake
aloud: that explanation is useful preparation for a written exam and a practical
demonstration.
