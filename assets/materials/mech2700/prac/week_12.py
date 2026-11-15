"""
Demo of explicit finite difference solution to Burger's equation for a shock
formation problem.

Created on Oct 18 2024

@author: V. Wheatley
"""

from math import pi

import matplotlib.pyplot as plt
import numpy as np

# Unsteady, 1D Burger's solver.
#
# Problem parameters
IC = 2  # IC number: 1=wave, 2=shock
L = 1.0  # m, length of domain
N = 200  # number of subdivisions
uL = IC * 1.0  # m/s, left velocity BC
uR = 1.0  # m/s, right velocity BC
tplot = 0.1  # s, time interval for plotting
tmax = 0.4  # s, simulation duration
A = 50.0  # Pa, pressure perturbation magnitude
x0 = 0.2  # m, transition start location
w0 = 0.2  # m, transition width


def upwind_step(u, t, dt, dx):
    # Function to update solution
    unew = u.copy()
    sigma = dt / dx
    # update interior nodes
    unew[1:] = sigma * u[1:] * u[:-1] + (1 - sigma * u[1:]) * u[1:]
    # apply boundary conditions
    unew[0] = uL
    return unew


def conservative_step(u, t, dt, dx):
    """Advance the conservative Burgers equation by one upwind step"""
    unew = u.copy()
    sigma = dt / dx
    unew[1:] = u[1:] - 0.5 * sigma * (u[1:] ** 2 - u[:-1] ** 2)
    unew[0] = uL
    return unew


def findmid(x, u, dx, umid):
    """Return the interpolated location where the solution crosses umid"""
    for i in range(1, len(u)):
        if u[i] < umid:
            return x[i - 1] + dx * (umid - u[i - 1]) / (u[i] - u[i - 1])
    raise ValueError("Solution does not cross umid")


def make_initial_condition(x):
    # Initialise velocity
    u = 0.0 * x.copy() + uR
    for n in range(N + 1):
        if IC < 2:
            if abs(x[n] - x0) < x0:
                u[n] += 0.5 * (1 + np.cos(pi * (x[n] / x0 - 1)))
        else:
            if x[n] < x0:
                u[n] = uL
            elif (x[n] - x0) < w0:
                u[n] = uL - (uL - uR) * (x[n] - x0) / w0
    return u


def run():
    # Initialize spatial domain:
    x = np.linspace(0.0, L, N + 1)
    dx = x[1] - x[0]

    u = make_initial_condition(x)

    # %% Solve evolution problem
    dt_hyp = 0.5 * dx / uL
    dt = dt_hyp
    # print("Timestep dt =", dt, "s")

    plt.figure(1)
    plt.plot(x, u, ".-")
    plt.xlabel("x, m")
    plt.ylabel("u, m/s")
    # %%
    # Store T distributions for plotting
    uplot = u.copy()
    t = 0.0
    tlist = ["t = 0.0 s"]
    ts = []
    ts.append(0)
    next_plot = tplot
    Nplot = 0

    # March in time
    while t < tmax:
        if t + dt > tmax:
            dt = tmax - t
        u = conservative_step(u, t, dt, dx)
        t += dt
        if t >= next_plot:
            tlist.append(f"t = {next_plot:.1f} s")
            ts.append(t)
            next_plot += tplot
            Nplot += 1
            uplot = np.vstack([uplot, u])

    for i in range(1, Nplot + 1):
        plt.plot(x, uplot[i, :], ".-")
    plt.legend(tlist)
    plt.show()

    umid = 0.5 * (uL + uR)
    xm = findmid(x, uplot[-2, :], dx, umid)
    xp = findmid(x, uplot[-1, :], dx, umid)
    Vs = (xp - xm) / (ts[-1] - ts[-2])
    return Vs


if __name__ == "__main__":
    sample = np.array([2.0, 1.5, 1.0])
    np.testing.assert_allclose(
        conservative_step(sample, 0.0, 0.1, 1.0), [2.0, 1.5875, 1.0625]
    )
    np.testing.assert_array_equal(sample, [2.0, 1.5, 1.0])
    assert findmid(np.array([0.0, 1.0]), np.array([2.0, 1.0]), 1.0, 1.5) == 0.5

    Vs = run()
    print("Simulated shock speed is approximately Vs =", Vs, "m/s")
