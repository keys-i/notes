"""Solve heat diffusion in a rod with a constant heat flux at the left end"""

import matplotlib.pyplot as plt
import numpy as np

# == Constants ==
D = 2.2e-5  # Thermal diffusivity [m^2/s]
L = 0.5  # Rod length [m]
N = 40  # Number of subdivisions
TL = 300  # Right boundary temperature [K]
k = 45  # Thermal conductivity [W/(m K)]
qin = 20000  # Heat flux entering the left end [W/m^2]
tplot = 200  # Plot interval [s]
tmax = 1000  # Simulation duration [s]


# == Functions ==
def euler_step(T, t, D, dt, dx):
    """Advance one explicit step, then apply the boundary conditions"""
    Tnew = T.copy()
    sigma = dt * D / dx**2
    Tnew[1:-1] = sigma * T[:-2] + (1 - 2 * sigma) * T[1:-1] + sigma * T[2:]
    # Both temperatures in the flux condition must be at the new time level
    Tnew[0] = Tnew[1] + qin * dx / k
    Tnew[-1] = TL
    return Tnew


def main():
    x = np.linspace(0.0, L, N + 1)
    dx = x[1] - x[0]
    dt = 0.5 * dx * dx / D
    print(f"Time step: {dt:.6f} s")

    T = np.full(N + 1, TL, dtype=float)
    _, ax = plt.subplots()
    ax.plot(x, T, ".-", label="t = 0.0 s")
    t = 0.0
    next_plot = tplot

    while t < tmax:
        T = euler_step(T, t, D, dt, dx)
        t += dt
        if t >= next_plot:
            next_plot += tplot
            ax.plot(x, T, ".-", label=f"t = {t:.2f} s")

    ax.set_xlabel("Position [m]")
    ax.set_ylabel("Temperature [K]")
    ax.legend()
    return T


if __name__ == "__main__":
    initial = np.array([300.0, 320.0, 300.0, 300.0])
    updated = euler_step(initial, 0, D, 0.25 * 0.1**2 / D, 0.1)
    np.testing.assert_allclose(updated, [310 + qin * 0.1 / k, 310, 305, TL])
    np.testing.assert_array_equal(initial, [300, 320, 300, 300])

    x = np.linspace(0.0, L, N + 1)
    dx = x[1] - x[0]
    steady = TL + qin * (L - x) / k
    np.testing.assert_allclose(euler_step(steady, 0, D, 0.5 * dx * dx / D, dx), steady)
    main()
    plt.show()
