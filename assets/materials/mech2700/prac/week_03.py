"""
Curve fit for the enthalpy of molecular oxygen
"""

import matplotlib.pyplot as plt
import numpy as np


def h(T):
    return 259.8 * (
        3.782 * T
        - (2.997e-3 * T**2) / 2
        + (9.847e-6 * T**3) / 3
        - (9.681e-9 * T**4) / 4
        - 1.064e3
    )


def Cp_central_difference(T, delta_T):
    return (h(T + delta_T) - h(T - delta_T)) / (2 * delta_T)


def Cp_exact(T):
    return 259.8 * (3.782 - 2.997e-3 * T + 9.847e-6 * T**2 - 9.681e-9 * T**3)


def plot_Cp_error(T):
    delta_T = np.logspace(-4, 2, 50)

    Cp_fini_diff = Cp_central_difference(T, delta_T)
    Cp_simple = Cp_exact(T)

    error = np.abs(Cp_fini_diff - Cp_simple)

    plt.figure()
    plt.loglog(delta_T, error, marker="o", markersize=4)
    plt.xlabel("Step size, Delta T (K)")
    plt.ylabel("Absolute error in Cp (J/(kg K))")
    plt.title(f"Central-difference error for Cp at T = {T} K")
    plt.grid(True, which="both")
    plt.tight_layout()
    plt.show()


for T in [500, 600]:
    for step in np.arange(0.1, 0.5 + 0.005, 0.01):
        Cp = Cp_central_difference(T, step)

        print(
            f"The constant-pressure specific heat at T = {T} K "
            f"with ΔT = {step:.2f} K is {Cp:.2f} J/(kg·K)"
        )
    plot_Cp_error(T)
