"""
3-point Gaussian quadrature between two points
"""

import numpy as np

# -- values --
MU = 0.75
SIGMA = 0.5

XI = np.array([-np.sqrt(3 / 5), 0.0, np.sqrt(3 / 5)])
W = np.array([5 / 9, 8 / 9, 5 / 9])


# -- functs --
def gaussian_quadrature_3pt(x0, x1):
    x = (x0 + x1) / 2 + (x1 - x0) / 2 * XI

    # Normal prob density
    prob_density = (
        1 / np.sqrt(2 * np.pi * SIGMA**2) * np.exp(-((x - MU) ** 2) / (2 * SIGMA**2))
    )

    # 3-point Gaussian quadrature
    return (x1 - x0) / 2 * np.sum(W * prob_density)


p = gaussian_quadrature_3pt(0.5, 1.0)

print(f"3-point Gaussian quadrature estimate: {p:.10f}")
