"""
Hydrocarbon-combustion Linear system using numpy
"""

import numpy as np


def hydrocarbon_combustion():
    A = np.array(
        [
            [2, -1, 0],
            [8, -1, -2],
            [0, 2, -1],
        ],
        dtype=float,
    )
    b = np.array([4, 0, 0], dtype=float)

    return A, b


def my_det(A):
    return np.linalg.det(A)


def determine_coefficients(A, b):
    return np.linalg.solve(A, b)


A, b = hydrocarbon_combustion()
x = determine_coefficients(A, b)

print(f"""
A = {A}
b = {b}
det(A) = {my_det(A):g}
x = {x}
""")
