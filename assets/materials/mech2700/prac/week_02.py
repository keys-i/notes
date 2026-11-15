"""
A correlation for the thermal conductivity k of Titanium (in W/m/K) as a
function of temperature
"""

from math import exp

import matplotlib.pyplot as plt
import numpy as np

# -- variables --
A = 1.5531
B = 0.8703
C = -12.4882 * pow(10, -4)
D = 143.6


# -- functs --
def thermal_conductivity(T):
    return A * pow(T, B) * exp(C * T) * exp(D / T)


def lagrange_basis_function(j, x, xs):
    result = 1.0
    for i, xi in enumerate(xs):
        if i != j:
            result *= (x - xi) / (xs[j] - xi)
    return result


def interpolate(xs, ys, x):
    sum = 0
    for j in range(len(xs)):
        sum += ys[j] * lagrange_basis_function(j, x, xs)
    return sum


def plot_thermal_conductivity():
    Tsf = np.linspace(100.0, 900.0, 100)
    k_interp = []
    for T in Tsf:
        k_interp.append(interpolate(Ts, ks, T))
    plt.plot(Tsf, k_interp, label="interpolated")
    plt.plot(Ts, ks, "o", label="data")
    plt.xlabel("Temperature")
    plt.ylabel(r"Thermal Conductivity")
    plt.title("Thermal Conductivity of Titanium")
    plt.legend()
    plt.show()


Ts = [100.0, 200.0, 300.0, 500.0, 700.0, 900.0]
ks = []
for T in Ts:
    ks.append(thermal_conductivity(T))

for t in Ts:
    print(f"Thermal Conductivity at {t}K = {thermal_conductivity(t):.2f} W/m/K")

print(f"\nInterpolated Conductivity at 250K = {interpolate(Ts, ks, 250.0):.2f} W/m/K")
print(f"Exact Conductivity at 250K = {thermal_conductivity(250.0):.2f} W/m/K\n")

plot_thermal_conductivity()
