"""
Solve the aircraft ODE using modified Euler (Heun)
"""

import numpy as np

# -- consts --
THRUST_ACCEL = 242000 / 70000
DRAG_FACTOR = 0.5 * 0.08 * 125 * 1.225 / 70000


# -- functs --
def modified_euler_step(func, t0, y0, h):
    k1 = func(t0, y0)
    k2 = func(t0 + h, y0 + h * k1)
    return y0 + h * (k1 + k2) / 2


def integrate_ode(func, t0, y0, h, n_steps):
    if n_steps < 0:
        raise ValueError("n_steps must be non-negative")
    ts = t0 + h * np.arange(n_steps + 1)
    ys = [np.asarray(y0, dtype=float)]
    for t in ts[:-1]:
        ys.append(modified_euler_step(func, t, ys[-1], h))
    return ts, np.array(ys)


def aircraft_ode(t, state):
    velocity = state[1]
    return np.array([velocity, THRUST_ACCEL - DRAG_FACTOR * velocity**2])


def main():
    _, ys = integrate_ode(aircraft_ode, 0, np.zeros(2), 1.0, 20)
    return float(ys[-1, 1])


if __name__ == "__main__":
    _, ys = integrate_ode(lambda t, y: y**2, 0, 1, 0.1, 1)
    np.testing.assert_allclose(ys, [1, 1.1105])
    print(main())
