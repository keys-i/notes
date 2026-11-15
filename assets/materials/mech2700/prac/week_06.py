"""
Jacobi iteration for the temperature distribution in a heated support beam
"""

import numpy as np

# -- consts --
SOURCE_TERM = 4e5 * 0.1**2 / 170
L_OFFSET, M_OFFSET, R_OFFSET = (
    (300 + SOURCE_TERM) / 2,
    SOURCE_TERM / 2,
    (750 + SOURCE_TERM) / 2,
)


# -- functs --
def update_temperatures(Ts: np.ndarray) -> np.ndarray:
    t0, t1, t2 = Ts
    return np.array(
        (L_OFFSET + 0.5 * t1, M_OFFSET + 0.5 * (t0 + t2), R_OFFSET + 0.5 * t1)
    )


def jacobi_iteration(
    initial_guess: np.ndarray,
    n_iters: int,
):
    t0, t1, t2 = initial_guess

    for _ in range(n_iters):
        t0, t1, t2 = (
            L_OFFSET + 0.5 * t1,
            M_OFFSET + 0.5 * (t0 + t2),
            R_OFFSET + 0.5 * t1,
        )

    return np.array((t0, t1, t2))


def main():
    inital_guess = np.array((337.5, 375.0, 412.5), dtype=np.float64)
    return jacobi_iteration(inital_guess, 5)


if __name__ == "__main__":
    print(main())
