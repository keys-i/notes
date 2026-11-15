"""Fit a Chebyshev model to sounding-rocket telemetry"""

import matplotlib.pyplot as plt
import numpy as np


def eval_model(x, phi, alpha):
    """Evaluate a model defined by basis functions and coefficients"""
    assert len(phi) == len(alpha)
    value = 0.0
    for coefficient, basis_function in zip(alpha, phi):
        value += coefficient * basis_function(x)
    return value


def fit_model(phi, xdata, ydata):
    """Fit a model to data in the least-squares sense"""
    m = len(phi)
    n = len(xdata)
    assert len(ydata) == n
    assert m < n

    vdm = np.zeros((m, m), float)
    rhs = np.zeros(m, float)
    for j in range(m):
        for k in range(m):
            for i in range(n):
                vdm[j, k] += phi[j](xdata[i]) * phi[k](xdata[i])
        for i in range(n):
            rhs[j] += ydata[i] * phi[j](xdata[i])
    return np.linalg.solve(vdm, rhs)


def chebyshev_polynomials():
    """Return the first five Chebyshev polynomials"""
    return [
        lambda x: np.ones_like(x, dtype=float),
        lambda x: x,
        lambda x: 2 * x**2 - 1,
        lambda x: 4 * x**3 - 3 * x,
        lambda x: 8 * x**4 - 8 * x**2 + 1,
    ]


def scale_to_chebyshev_domain(x, x_min, x_max):
    """Scale values from [x_min, x_max] to [-1, 1]"""
    if x_min >= x_max:
        raise ValueError("x_min must be less than x_max")
    return 2 * (np.asarray(x, dtype=float) - x_min) / (x_max - x_min) - 1


def quantify_error(y, y_fit):
    """Return the sum of squared errors between two equally shaped arrays"""
    y = np.asarray(y, dtype=float)
    y_fit = np.asarray(y_fit, dtype=float)
    if y.shape != y_fit.shape:
        raise ValueError("y and y_fit must have the same shape")
    return float(np.sum((y - y_fit) ** 2))


time_s = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280]

altitude_km = [
    0.0,
    7.8,
    26.0,
    52.7,
    85.6,
    122.0,
    158.3,
    191.5,
    219.3,
    241.2,
    257.0,
    267.9,
    274.2,
    278.0,
    280.1,
]


def main():
    scaled_time = scale_to_chebyshev_domain(time_s, min(time_s), max(time_s))
    basis = chebyshev_polynomials()
    coefficients = fit_model(basis, scaled_time, altitude_km)
    fitted_altitude = eval_model(scaled_time, basis, coefficients)
    return quantify_error(altitude_km, fitted_altitude)


if __name__ == "__main__":
    polynomials = chebyshev_polynomials()
    np.testing.assert_allclose(
        [polynomial(0.5) for polynomial in polynomials],
        [1, 0.5, -0.5, -1, -0.5],
    )
    np.testing.assert_allclose(
        scale_to_chebyshev_domain([0, 140, 280], 0, 280), [-1, 0, 1]
    )
    assert quantify_error([1, 2], [2, 4]) == 5

    plt.plot(time_s, altitude_km, "bo")
    plt.xlabel("Time [s]")
    plt.ylabel("Altitude [km]")
    plt.grid()
    print(main())
    plt.show()
