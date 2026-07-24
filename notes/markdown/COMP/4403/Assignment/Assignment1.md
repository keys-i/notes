# Assignment 1

> rough notes based on spec

## Overview

Need to extend the A1 PL0 recursive descent compiler so it supports:

- set types like `setof R`
- set constructors like `{10, -3, 5, 10+1}:SR`
- set equality and inequality
- set union, intersection, and subtraction
- set complement using `~`
- set membership using `in`
- `for` statements that iterate over the elements of a set
- interpreter support for the new set operations and for loops

Basically:

$$
\text{recursive parser} \rightarrow \text{AST} \rightarrow \text{type support}
\rightarrow \text{static checker} \rightarrow \text{interpreter}
$$

> [!NOTE]
> If the parser or AST shape is messy, the checker and interpreter will be
> painful. Keep It Simple, Stupid.

---

## Strict Rules

- [ ] Only change the allowed files
- [ ] Do not modify unrelated compiler files
- [ ] Do not reformat random existing code
- [ ] Do not touch unrelated files just because the IDE suggests it
- [ ] No imports outside `java.util.*`
- [ ] No debugging prints in final code
- [ ] Keep lines under 100 characters
- [ ] Avoid non-standard characters in submitted Java comments
- [ ] Avoid tabs or keep tab stops at 4 spaces
- [ ] Do not submit this `TODO.md`
- [ ] Need to add `UseOfAI.pdf`

Allowed files:

- `ExpNode.java`
- `ExpTransform.java`
- `Interpreter.java`
- `Parser.java`
- `StatementNode.java`
- `StatementVisitor.java`
- `StaticChecker.java`
- `Type.java`
- `UseOfAI.pdf`

---

## Rough Order of Adding Stuff

1. Recursive descent parser changes
2. AST nodes + transform/visitor methods
3. Set type and operator support
4. Static checking
5. Interpreter support
6. Testing
7. Cleanup + `UseOfAI.pdf`

> [!TIP]
> Get one tiny valid set program working end-to-end first, then check edge
> cases.

---

## 1. Parser

File:

- `Parser.java`

### 1.1 Easy setup checks

- [ ] Lexer already has `LCURLY` and `RCURLY`
- [ ] Lexer already has `SET_COMPLEMENT`
- [ ] Lexer already has `KW_FOR`
- [ ] Lexer already has `KW_IN`
- [ ] Lexer already has `KW_SETOF`
- [ ] Confirm the parser can see the new tokens
- [ ] Keep parser changes close to the existing recursive descent style
- [ ] Keep syntax error recovery consistent with the existing parser
- [ ] Do not touch generated or unrelated lexer files

> [!CAUTION]
> The scanner tokens are already provided for this assignment. The job here is
> the recursive descent parser, not scanner surgery.

### 1.2 Add set type syntax

Need:

```haskell
Type -> ... | SetType
SetType -> "setof" TypeIdentifier
```

- [ ] Extend type parsing with a set type alternative
- [ ] Parse `setof` followed by a type identifier
- [ ] Store the element type identifier
- [ ] Build a real set type representation
- [ ] Keep normal type identifiers working as before
- [ ] Keep subrange type parsing working as before

> [!IMPORTANT]
> The element type name is checked later. Do not make the parser do semantic
> work.

### 1.3 Add set constructor factors

Need:

```haskell
Factor -> ... | "{" [ Condition { "," Condition } ] "}" ":" TypeIdentifier
```

- [ ] Parse an empty set constructor
- [ ] Parse a set constructor with one expression
- [ ] Parse comma-separated constructor expressions
- [ ] Require the colon after the closing brace
- [ ] Store the set type identifier after the colon
- [ ] Store the element expressions in order
- [ ] Return a real expression node for the constructor
- [ ] Keep ordinary expression factors working as before

Examples:

```haskell
{}:SR
{10}:SR
{10, -3, 5, 10+1}:SR
```

> [!WARNING]
> This looks a bit like a block, but it is an expression factor.

### 1.4 Add set complement factors

Need:

```haskell
Factor -> ... | "~" Factor
```

- [ ] Parse set complement as a factor
- [ ] Store the operand expression
- [ ] Make sure complement has higher precedence than binary set operators
- [ ] Keep existing unary and factor behaviour unchanged

> [!NOTE]
> Complement binds tighter than set union, subtraction, and intersection.

### 1.5 Add set membership operator

Need:

```haskell
RelOp -> ... | "in"
```

- [ ] Add `in` as a relational operator
- [ ] Keep relational precedence lower than set arithmetic operators
- [ ] Make sure normal relational operators still parse correctly
- [ ] Make sure `i in s` parses as a boolean-valued condition shape

> [!IMPORTANT]
> `in` is relational-level syntax, not another additive operator.

### 1.6 Check set operator precedence

Need set operators to behave like:

- `+` means set union
- `*` means set intersection
- `-` means set subtraction
- `~` means set complement
- `in` means set membership

Checklist:

- [ ] Keep set union and set subtraction left associative
- [ ] Keep set union and set subtraction at the same precedence
- [ ] Keep set intersection left associative
- [ ] Keep set intersection higher precedence than union and subtraction
- [ ] Keep set complement higher precedence than binary set operators
- [ ] Keep relational operators lower precedence than set operators
- [ ] Do not break numeric arithmetic precedence

> [!CAUTION]
> The same symbols are used for both numeric and set operations, so parser
> precedence should stay boring and consistent.

### 1.7 Add for statement syntax

Need:

```haskell
Statement -> ... | SetForStatement
SetForStatement -> "for" IDENTIFIER ":" Condition "do" Statement
```

- [ ] Add `for` as a statement start
- [ ] Parse the control variable identifier
- [ ] Require the colon
- [ ] Parse the set expression after the colon
- [ ] Require `do`
- [ ] Parse the loop body statement
- [ ] Build a real for statement node
- [ ] Keep existing statement parsing and recovery working

Example:

```haskell
for r : x do
  write r
```

> [!NOTE]
> The control variable is introduced by the for statement. It is not just a
> normal existing variable lookup.

### 1.8 Parser error recovery

- [ ] Follow the existing recursive descent recovery style
- [ ] Add recovery sets for new set syntax where needed
- [ ] Add recovery sets for the for statement where needed
- [ ] Avoid parser crashes on malformed set constructors
- [ ] Avoid parser crashes on malformed for statements
- [ ] Run a few invalid syntax examples before moving on

> [!WARNING]
> Syntax error recovery is part of the A1 syntax-analysis mark, so do not leave
> the parser fragile.

---

## 2. AST

Files:

- `ExpNode.java`
- `ExpTransform.java`
- `StatementNode.java`
- `StatementVisitor.java`

### 2.1 Add set constructor expression support

- [ ] Add an expression node for set constructors
- [ ] Store the set type name
- [ ] Store the element expression list
- [ ] Support an empty element list
- [ ] Leave name/type resolution for the checker
- [ ] Add transform support
- [ ] Add string/debug representation in the existing style

> [!TIP]
> Let the checker resolve the type name. Keep parser-built nodes simple.

### 2.2 Add set complement expression support

- [ ] Add expression support for set complement
- [ ] Store the operand expression
- [ ] Add transform support
- [ ] Add string/debug representation in the existing style
- [ ] Keep existing unary expression behaviour unchanged

> [!NOTE]
> This is the new unary set operator.

### 2.3 Add set membership expression/operator support

- [ ] Add expression/operator support for `in`
- [ ] Keep it in the same general expression structure as relational operators
- [ ] Store the left expression
- [ ] Store the right expression
- [ ] Add transform support if needed by the existing design

> [!IMPORTANT]
> Membership returns a boolean value, not a set value.

### 2.4 Add for statement support

- [ ] Add a statement node for set for loops
- [ ] Store the control variable name
- [ ] Store the set expression
- [ ] Store the body statement
- [ ] Add statement visitor support
- [ ] Keep the node simple and avoid semantic checking inside it

Example shape:

```haskell
for r : x do
  write r
```

> [!NOTE]
> The checker and interpreter handle the meaning. The AST should just preserve
> the structure.

### 2.5 Add visitor and transform methods

- [ ] Add expression transform support for set constructors
- [ ] Add expression transform support for set complement
- [ ] Add expression/operator support for set membership if needed
- [ ] Add statement visitor support for set for loops
- [ ] Update default paths that would otherwise miss the new nodes

> [!WARNING]
> Forgetting one visitor or transform path is the classic instant compile
> failure.

---

## 3. Type and Operator Support

File:

- `Type.java`

### 3.1 Check existing set type support

The spec says `SetType` has already been added in `Type.java`.

Checklist:

- [ ] Inspect the existing `SetType` class
- [ ] Confirm how the element type is stored
- [ ] Confirm how `resolveType` checks well-formedness
- [ ] Confirm how set type equality is implemented
- [ ] Avoid rewriting existing working set type code
- [ ] Preserve existing behaviour for non-set types

> [!IMPORTANT]
> Do not replace provided support unless it is actually incomplete for the
> assignment task.

### 3.2 Validate set type declarations

Set element types must be subrange types with at most 32 values.

Checklist:

- [ ] Reject set element types that are not subrange types
- [ ] Reject set element subranges with more than 32 values
- [ ] Allow valid subrange element types
- [ ] Preserve existing type alias behaviour
- [ ] Keep errors clear and source locations useful

Examples:

```haskell
type R = [-3..11];
     SR = setof R;
```

> [!NOTE]
> The 32-element limit exists because set values fit in one 32-bit word.

### 3.3 Type equivalence for sets

Two set types are equivalent when their element types are equivalent.

Example:

```haskell
type R3 = [1..3];
     A = setof R3;
     B = A;
     C = setof R3;
```

- [ ] Preserve existing type identifier and alias behaviour
- [ ] Treat equivalent element types as equivalent set types
- [ ] Allow assignments between equivalent set types
- [ ] Keep non-set type equivalence unchanged

> [!NOTE]
> Follow the existing `equals` behaviour for resolved set types.

### 3.4 Add set operators

Need operators for each declared set type:

```haskell
=  : T x T -> boolean
!= : T x T -> boolean
+  : T x T -> T
*  : T x T -> T
-  : T x T -> T
in : E x T -> boolean
~  : T -> T
```

Where:

```haskell
T = setof E
```

Checklist:

- [ ] Add equality for equivalent set types
- [ ] Add inequality for equivalent set types
- [ ] Add set union
- [ ] Add set intersection
- [ ] Add set subtraction
- [ ] Add set membership
- [ ] Add set complement
- [ ] Keep numeric operators unchanged
- [ ] Keep boolean operators unchanged

> [!TIP]
> Add only the operators required by the spec. No bonus language design side
> quests.

---

## 4. Static Checker

File:

- `StaticChecker.java`

### 4.1 Type-check set constructors

Need:

```haskell
{e1, e2, ..., en}:id
```

Checklist:

- [ ] Resolve the type identifier after the colon
- [ ] Make sure it names a set type
- [ ] Check every element expression
- [ ] Check every element expression is compatible with the set element type
- [ ] Allow repeated element expressions
- [ ] Allow empty set constructors when the type is known
- [ ] Set the constructor expression type to the named set type
- [ ] Give clear errors for unknown type identifiers
- [ ] Give clear errors for non-set type identifiers
- [ ] Give clear errors for wrong element types

Examples:

```haskell
{}:SR
{10, -3, 5, 10+1}:SR
```

> [!IMPORTANT]
> The type annotation after the constructor is what gives the set its type.

### 4.2 Type-check set complement

Need:

```haskell
~s
```

Checklist:

- [ ] Check the operand expression
- [ ] Require the operand to have a set type
- [ ] Set the result type to the same set type
- [ ] Reject complement on non-set values
- [ ] Keep other unary expression behaviour unchanged

> [!NOTE]
> Complement is a set-to-set operation.

### 4.3 Type-check set binary operators

Need:

```haskell
s1 + s2
s1 * s2
s1 - s2
```

Checklist:

- [ ] Check both operand expressions
- [ ] Require both operands to be set types
- [ ] Require compatible set types
- [ ] Set the result type to the set type
- [ ] Keep numeric uses of `+`, `*`, and `-` working
- [ ] Give clear errors for mixed numeric/set mistakes
- [ ] Give clear errors for incompatible set types

> [!CAUTION]
> The same symbols are reused for arithmetic and sets, so old arithmetic tests
> must still pass.

### 4.4 Type-check set equality and inequality

Need:

```haskell
s1 = s2
s1 != s2
```

Checklist:

- [ ] Allow equality between compatible set types
- [ ] Allow inequality between compatible set types
- [ ] Result type is boolean
- [ ] Reject equality between incompatible set types
- [ ] Keep existing equality behaviour for non-set types unchanged

> [!NOTE]
> Set equality means same elements, but the checker only needs the types.

### 4.5 Type-check set membership

Need:

```haskell
e in s
```

Checklist:

- [ ] Check the element expression
- [ ] Check the set expression
- [ ] Require the right side to have a set type
- [ ] Require the left side to be compatible with the set element type
- [ ] Set the result type to boolean
- [ ] Reject membership on non-set right-hand sides
- [ ] Give clear errors for incompatible element expressions

> [!IMPORTANT]
> `in` is not set-to-set. It is element-in-set.

### 4.6 Type-check for statements

Need:

```haskell
for id : e do s
```

Checklist:

- [ ] Check the set expression after the colon
- [ ] Require the expression to have a set type
- [ ] Treat the control variable as local to the for statement
- [ ] Give the control variable the set element type
- [ ] Make the control variable read-only inside the body
- [ ] Allow the control variable name to shadow an existing name
- [ ] Restore the previous binding after the body
- [ ] Type-check the loop body in the extended scope
- [ ] Reject assignments to the read-only control variable
- [ ] Keep nested for loops working

> [!WARNING]
> The control variable is read-only inside the loop body.

### 4.7 Error handling quality

- [ ] Use the best source location available for each semantic error
- [ ] Do not crash after syntax errors leave partial AST pieces
- [ ] Prefer specific messages for non-set constructor types
- [ ] Prefer specific messages for wrong constructor element types
- [ ] Prefer specific messages for invalid set operators
- [ ] Prefer specific messages for invalid for-loop expressions
- [ ] Prefer specific messages for assignment to read-only control variables
- [ ] Match provided test outputs where possible
- [ ] Do not add random debugging text to compiler output

> [!CAUTION]
> Automated tests may be strict about output for provided cases.

---

## 5. Interpreter

File:

- `Interpreter.java`

### 5.1 Runtime representation for sets

A set value should represent membership over a small subrange domain.

Checklist:

- [ ] Represent set values as a single integer value
- [ ] Use one bit per possible element in the element subrange
- [ ] Preserve value-copy assignment behaviour for sets
- [ ] Keep existing scalar value behaviour unchanged
- [ ] Keep existing reference behaviour unchanged

> [!NOTE]
> Sets are limited to at most 32 possible elements, so one integer can hold the
> whole set value.

### 5.2 Interpret set constructors

Need:

```haskell
{e1, e2, ..., en}:id
```

Checklist:

- [ ] Evaluate each element expression
- [ ] Convert each element value into the correct set position
- [ ] Add each element into the set value
- [ ] Allow repeated elements
- [ ] Allow empty set constructors
- [ ] Return a set value with the correct type information

Examples:

```haskell
{}:SR
{10, -3, 5, 10+1}:SR
```

> [!IMPORTANT]
> Repeated elements are not runtime errors.

### 5.3 Interpret set union, intersection, and subtraction

Need:

```haskell
s1 + s2
s1 * s2
s1 - s2
```

Checklist:

- [ ] Evaluate both set operands
- [ ] Implement set union
- [ ] Implement set intersection
- [ ] Implement set subtraction
- [ ] Return a set value of the same set type
- [ ] Keep numeric arithmetic interpretation unchanged

> [!CAUTION]
> Do not break old arithmetic while adding set arithmetic.

### 5.4 Interpret set complement

Need:

```haskell
~s
```

Checklist:

- [ ] Evaluate the set operand
- [ ] Compute complement relative to the set type's element domain
- [ ] Return a set value of the same set type
- [ ] Keep complement limited to valid elements of the set domain

> [!WARNING]
> Complement is relative to the declared set domain, not all integer bits.

### 5.5 Interpret set equality and inequality

Need:

```haskell
s1 = s2
s1 != s2
```

Checklist:

- [ ] Evaluate both set operands
- [ ] Compare set contents
- [ ] Return a boolean value
- [ ] Keep existing equality behaviour unchanged for non-set values

> [!NOTE]
> Set equality is based on exactly the same elements being present.

### 5.6 Interpret set membership

Need:

```haskell
e in s
```

Checklist:

- [ ] Evaluate the element expression
- [ ] Evaluate the set expression
- [ ] Check whether the element is present in the set
- [ ] Return a boolean value
- [ ] Handle elements from the element type domain correctly
- [ ] Keep the result false when the element is not present

> [!IMPORTANT]
> Membership is a boolean-valued expression.

### 5.7 Interpret for statements

Need:

```haskell
for id : e do s
```

Runtime behaviour:

- the set expression is evaluated at the start of the loop
- the body runs once for each element in that initial set value
- elements are visited in increasing order
- changes to the set expression during the loop do not change the iteration set
- the control variable is assigned by the loop itself

Checklist:

- [ ] Evaluate the set expression once at the start
- [ ] Iterate over the initial set value
- [ ] Visit elements in increasing order
- [ ] Assign the control variable at the start of each iteration
- [ ] Execute the body once for each present element
- [ ] Keep the control variable read-only to user assignments
- [ ] Handle an empty set by executing the body zero times
- [ ] Keep nested for loops working

> [!WARNING]
> The loop iterates over the initial value of the set expression, not a live
> changing view of it.

---

## 6. Testing

### 6.1 Basic test order

- [ ] Run all provided base tests first
- [ ] Run all provided set/for tests
- [ ] Run tiny hand-written tests after every major feature
- [ ] If old tests break, check recent parser/checker/interpreter changes
- [ ] Run final tests from a clean rebuild
- [ ] Do not rely on stale runs or old compiled classes

> [!IMPORTANT]
> Regression tests matter because old arithmetic, references, and statements
> are easy to break while adding set features.

### 6.2 Syntax tests

- [ ] Valid set type declaration
- [ ] Set constructor with no elements
- [ ] Set constructor with one element
- [ ] Set constructor with multiple elements
- [ ] Set constructor with repeated elements
- [ ] Set complement expression
- [ ] Set union expression
- [ ] Set intersection expression
- [ ] Set subtraction expression
- [ ] Set membership expression
- [ ] For statement over a set variable
- [ ] For statement over a set constructor
- [ ] Nested for statements
- [ ] Old PL0 syntax still parses

### 6.3 Static checking tests

- [ ] Set type whose element type is a valid subrange
- [ ] Set type whose element type is not a subrange
- [ ] Set type whose element subrange has more than 32 values
- [ ] Constructor with valid element expressions
- [ ] Constructor with wrong element expression type
- [ ] Constructor using an unknown type identifier
- [ ] Constructor using a non-set type identifier
- [ ] Assignment between compatible set types
- [ ] Assignment between incompatible set types is rejected
- [ ] Set union with compatible set types
- [ ] Set intersection with compatible set types
- [ ] Set subtraction with compatible set types
- [ ] Set operators reject incompatible set types
- [ ] Set complement rejects non-set operands
- [ ] Set membership accepts valid element/set pairs
- [ ] Set membership rejects invalid element/set pairs
- [ ] Set equality and inequality work for compatible set types
- [ ] For loop accepts a set expression
- [ ] For loop rejects a non-set expression
- [ ] For control variable shadows existing variables correctly
- [ ] For control variable is read-only
- [ ] Old PL0 static checking tests still pass

### 6.4 Runtime/interpreter tests

- [ ] Set constructor produces the expected set value
- [ ] Empty set constructor produces an empty set
- [ ] Repeated constructor elements only appear once
- [ ] Set assignment copies by value
- [ ] Reassigning source set does not mutate copied set
- [ ] Set union produces expected elements
- [ ] Set intersection produces expected elements
- [ ] Set subtraction produces expected elements
- [ ] Set complement produces expected elements within the domain
- [ ] Set equality returns true for same elements in different order
- [ ] Set equality returns false for different elements
- [ ] Set membership returns true for present elements
- [ ] Set membership returns false for absent elements
- [ ] For loop visits elements in increasing order
- [ ] For loop over an empty set runs zero times
- [ ] For loop uses the initial set value even if the set changes
- [ ] Nested for loops behave correctly
- [ ] Old PL0 interpreter tests still pass

---

## 7. Cleanup

- [ ] Remove debug prints
- [ ] Check imports for IDE garbage
- [ ] Check there are no imports outside `java.util.*`
- [ ] Make sure only allowed files were edited
- [ ] Check line lengths are sensible
- [ ] Avoid tabs or keep tab stops at 4 spaces
- [ ] Do not reformat unrelated existing code
- [ ] Keep comments short and consistent with the existing codebase
- [ ] Avoid non-standard characters in comments
- [ ] Fix obvious comment typos introduced while working
- [ ] Check indentation of new code matches nearby code
- [ ] Run final tests from scratch
- [ ] Confirm all required files are ready
- [ ] Confirm no extra files are being submitted
- [ ] Confirm `UseOfAI.pdf` exists and has the required AI/MT statement

> [!WARNING]
> `UseOfAI.pdf` is required even if no AI or MT was used.
