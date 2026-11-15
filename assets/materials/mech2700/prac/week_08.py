"""
Find the nozzle exit pressure using the bisection method
"""

from math import isclose, isfinite, sqrt

# == Constants ==
CP = 1005
T0 = 900
P0 = 350000
GAMMA = 1.4
EXIT_VELOCITY = 700


# == Functions ==
def func(p):
    """Return the velocity residual in m/s for pressure p in Pa"""
    if not 0 <= p <= P0:
        raise ValueError("Pressure must be between 0 and P0")
    return sqrt(2 * CP * T0 * (1 - (p / P0) ** ((GAMMA - 1) / GAMMA))) - (EXIT_VELOCITY)


def bisect(f, p_left, p_right, tol=1e-8):
    """Bisect a continuous function until abs(f(p)) < tol"""
    if not isfinite(tol) or tol <= 0:
        raise ValueError("tol must be positive and finite")
    if not (isfinite(p_left) and isfinite(p_right)) or p_left > p_right:
        raise ValueError("Endpoints must be finite and ordered")

    f_left = f(p_left)
    if not isfinite(f_left):
        raise ValueError("Function values must be finite")
    if f_left == 0:
        return p_left
    f_right = f(p_right)
    if not isfinite(f_right):
        raise ValueError("Function values must be finite")
    if f_right == 0:
        return p_right
    if (f_left > 0) == (f_right > 0):
        return None

    while True:
        p_mid = 0.5 * p_left + 0.5 * p_right
        f_mid = f(p_mid)
        if not isfinite(f_mid):
            raise ValueError("Function values must be finite")
        if abs(f_mid) < tol:
            return p_mid
        if p_mid == p_left or p_mid == p_right:
            raise ArithmeticError("Tolerance is below floating-point precision")
        if (f_left > 0) == (f_mid > 0):
            p_left, f_left = p_mid, f_mid
        else:
            p_right = p_mid


def main():
    return bisect(func, 50000, P0)


if __name__ == "__main__":
    assert bisect(lambda x: x, 0, 1) == 0
    assert bisect(lambda x: x - 1, 0, 1) == 1
    assert bisect(lambda x: x - 1, 0, 2) == 1
    assert bisect(lambda x: x**2 + 1, -1, 1) is None
    root = bisect(lambda x: x**2 - 2, 0, 2)
    assert root is not None and isclose(root, sqrt(2), abs_tol=1e-8)
    pressure = main()
    assert pressure is not None and abs(func(pressure)) < 1e-8
    exact = P0 * (1 - EXIT_VELOCITY**2 / (2 * CP * T0)) ** (GAMMA / (GAMMA - 1))
    assert isclose(pressure, exact, abs_tol=1e-5)
    print(pressure)
