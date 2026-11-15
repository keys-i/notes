"""Solve an unforced vehicle suspension using modified Euler"""

import numpy as np


def u_dot(t, u, m, c, k):
    """Return the time derivative of the suspension state

    Args:
        t: Time in s
        u: Position in m and velocity in m/s
        m: Vehicle mass in kg
        c: Damping coefficient in N s/m
        k: Spring constant in N/m

    Returns:
        Velocity in m/s and acceleration in m/s^2
    """
    position, velocity = u
    acceleration = (-c * velocity - k * position) / m
    return np.array([velocity, acceleration], dtype=float)


def mod_euler(f, t, u, h):
    """Advance a state by one modified Euler step

    Args:
        f: Function returning the state derivative as ``f(t, u)``
        t: Current time
        u: State at the current time
        h: Time-step size

    Returns:
        State at time ``t + h`` as a NumPy array
    """
    state = np.asarray(u, dtype=float)
    initial_rate = np.asarray(f(t, state), dtype=float)
    predicted_state = state + h * initial_rate
    predicted_rate = np.asarray(f(t + h, predicted_state), dtype=float)
    return state + 0.5 * h * (initial_rate + predicted_rate)


def main(u, m, k, c, h, n):
    """Return the vehicle position after ``n`` modified Euler steps

    Args:
        u: Initial position in m and velocity in m/s
        m: Vehicle mass in kg
        k: Spring constant in N/m
        c: Damping coefficient in N s/m
        h: Time-step size in s
        n: Number of time steps

    Returns:
        Vehicle position in m after ``n`` steps
    """
    state = np.asarray(u, dtype=float)
    time = 0.0

    def suspension_rate(current_time, current_state):
        return u_dot(current_time, current_state, m, c, k)

    for _ in range(n):
        state = mod_euler(suspension_rate, time, state, h)
        time += h

    return float(state[0])
