"""
Floating-point equality trap
"""

a = 0.1 + 0.2
b = 0.3

# -- Values --
print(f"""
Value of a = {a:.4f}
Value of b = {b:.4f}
""")

# -- Comparing a and b --
if abs(a - b) < 1e-9:
    print("Both are equal are tolerance")
else:
    print("Not equal")

# -- Absolute Values --
print(f"""
Exact value of a = {a!r}
Exact value of b = {b!r}
""")
