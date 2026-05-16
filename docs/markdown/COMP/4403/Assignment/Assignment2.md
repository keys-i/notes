# Assignment 2

> rough notes based on spec

## Overview

Need to extend the A2 PL0 LALR compiler so it supports:

- union types like `union num:int, bool:boolean, sub:S end`
- union constructors like `U{num, 4}` and `U{bool, true}`
- explicit union casts like `z:bool` and chained casts like `z:outer:inner`
- assignment through casts, e.g. `z:bool := false`
- `unionswitch` statements with one branch for each union alternative
- runtime checks for bad casts and uninitialised/invalid union tags

Basically:

$$
\text{CUP grammar} \rightarrow \text{AST} \rightarrow \text{type support}
\rightarrow \text{static checker} \rightarrow \text{code generator}
$$

> [!NOTE]
> If the grammar or AST is messy, the checker and codegen will be painful.  
> Keep It Simple, Stupid.

---

## Strict Rules

- [ ] Only change the allowed files
- [ ] Do not directly edit generated parser or lexer files
- [ ] Regenerate parser files from `PL0.cup` after grammar changes
- [ ] Do not reformat random existing code
- [ ] Do not touch unrelated files just because the IDE suggests it
- [ ] No imports outside `java.util.*`
- [ ] No debugging prints in final code
- [ ] Keep lines under 100 characters
- [ ] Avoid non-standard characters in submitted Java comments
- [ ] Do not submit this `TODO.md`
- [ ] Need to add `UseOfAI.pdf`

Allowed files:

- `PL0.cup`
- `ExpNode.java`
- `ExpTransform.java`
- `StatementNode.java`
- `StatementTransform.java`
- `StatementVisitor.java`
- `Scope.java`
- `SymEntry.java`
- `Type.java`
- `StaticChecker.java`
- `CodeGenerator.java`
- `UseOfAI.pdf`

---

## Rough Order of Adding Stuff

1. CUP grammar
2. AST nodes + transform/visitor methods
3. Union type and symbol table support
4. Static checking
5. Code generation
6. Testing
7. Cleanup + `UseOfAI.pdf`

> [!TIP]
> Get one tiny valid union program working end-to-end first, then check edge
> cases.

---

## 1. Grammar

File:

- `PL0.cup`

### 1.1 Easy setup checks

- [ ] Lexer already has `KW_CASE`, `KW_ON`, `KW_UNION`, `KW_UNIONSWITCH`
- [ ] Lexer already has `LCURLY` and `RCURLY`
- [ ] Confirm the terminals are already declared in `PL0.cup`
- [ ] Add any new nonterminals needed for union alternatives and branches
- [ ] Keep CUP actions small and close to the existing style
- [ ] Do not touch generated lexer files

> [!CAUTION]
> The scanner is not the job here. Do not touch generated lexer files.

### 1.2 Add union type syntax

Need:

```haskell
Type -> TypeIdentifier | SubrangeType | UnionType
UnionType -> "union" Alternatives "end"
Alternatives -> Alternative { "," Alternative }
Alternative -> IDENTIFIER ":" TypeIdentifier
```

- [ ] Extend the type production with a union alternative
- [ ] Parse at least one union alternative
- [ ] Parse comma-separated alternatives
- [ ] Store each tag name
- [ ] Store each alternative type identifier
- [ ] Build a real union type representation, not a placeholder

> [!IMPORTANT]
> Alternative types are type identifiers, not arbitrary inline types.

### 1.3 Add union cast lvalues

Need:

```haskell
LValue -> IDENTIFIER | LValue ":" IDENTIFIER
```

- [ ] Extend the lvalue production recursively
- [ ] Store the base lvalue
- [ ] Store the cast tag identifier
- [ ] Make sure chained casts parse correctly
- [ ] Keep normal lvalues working exactly as before

> [!NOTE]
> Casts need to work anywhere lvalues are allowed.

### 1.4 Add union constructor factors

Need:

```haskell
Factor -> ... | TypeIdentifier "{" IDENTIFIER "," Condition "}"
```

- [ ] Add the constructor factor production
- [ ] Store the union type identifier
- [ ] Store the tag identifier
- [ ] Store the expression for the alternative value
- [ ] Return a real expression node for the constructor

Examples:

```haskell
U{num, 4}
U{bool, true}
U{sub, x + 1}
```

> [!WARNING]
> This looks a bit like a block, but it is an expression factor.

### 1.5 Add union switch statements

Need:

```haskell
Statement -> ... | UnionSwitchStatement
UnionSwitchStatement -> "unionswitch" IDENTIFIER "on" UnionBranchList "end"
UnionBranchList -> UnionBranch { UnionBranch }
UnionBranch -> "case" IDENTIFIER ":" StatementList
```

- [ ] Add `KW_UNIONSWITCH` as a statement start if needed
- [ ] Parse the selector identifier after `unionswitch`
- [ ] Require `on`
- [ ] Parse one or more `case tag: StatementList` branches
- [ ] Stop the branch list cleanly at `end`
- [ ] Build a union switch statement node with selector and ordered branches

> [!NOTE]
> Branch statement lists do not have an extra delimiter, so keep the grammar
> shape clean.

### 1.6 Check parser generation

- [ ] Run Java-CUP after editing `PL0.cup`
- [ ] Check for new conflicts or CUP errors
- [ ] Ignore only the old expected unused-terminal warnings
- [ ] Do not manually patch generated parser files
- [ ] Run one tiny parser-only program before touching codegen

> [!CAUTION]
> If CUP reports errors, the generated parser files may be stale. Do not trust
> a Java compile until CUP is clean.

---

## 2. AST

Files:

- `ExpNode.java`
- `ExpTransform.java`
- `StatementNode.java`
- `StatementTransform.java`
- `StatementVisitor.java`

### 2.1 Add union constructor expression support

- [ ] Add an expression node for union constructors
- [ ] Store the union type name
- [ ] Store the tag name
- [ ] Store the value expression
- [ ] Leave name/type resolution for the checker
- [ ] Add transform support
- [ ] Add string/debug representation in the existing style

> [!TIP]
> Let the checker resolve names. Do not make CUP do semantic work.

### 2.2 Add union cast lvalue/expression support

- [ ] Add an expression/lvalue node for union casts
- [ ] Store the base lvalue expression
- [ ] Store the tag name
- [ ] Make sure it can be used on the left side of assignment
- [ ] Add transform support
- [ ] Add string/debug representation in the existing style

> [!IMPORTANT]
> This must work both in expressions and on the left side of `:=`.

### 2.3 Add union switch statement support

- [ ] Add a statement node for union switches
- [ ] Store the selector variable name
- [ ] Store the branch labels
- [ ] Store the branch statement bodies
- [ ] Keep branch order stable
- [ ] Avoid doing semantic checking inside the AST node

> [!TIP]
> Ordered branches make later checking, messages, and codegen less painful.

### 2.4 Add visitor and transform methods

- [ ] Add expression transform support for union constructors
- [ ] Add expression transform support for union casts
- [ ] Add statement transform support for union switches
- [ ] Add statement visitor support for union switches
- [ ] Update default paths that would otherwise miss the new nodes

> [!WARNING]
> Forgetting one visitor or transform method is the classic instant compile
> failure.

---

## 3. Type and Symbol Support

Files:

- `Type.java`
- `SymEntry.java`
- `Scope.java`

### 3.1 Represent union types

A union type needs to represent:

```haskell
UnionType([
  (tag1, Type1),
  (tag2, Type2),
  ...
])
```

- [ ] Add union type support in `Type.java`
- [ ] Store alternatives in declaration order
- [ ] Support checking whether a tag exists
- [ ] Support finding the type for a tag
- [ ] Support finding enough information for later checking/code generation
- [ ] Preserve existing behaviour for non-union types

> [!TIP]
> Small helper methods here can stop checker/codegen from becoming a mess.

### 3.2 Validate union type declarations

Need to enforce:

- tags in the same union type are distinct
- every alternative type identifier is defined
- different tags may use the same alternative type
- an alternative type may itself be a union type
- recursive union definitions are rejected

Checklist:

- [ ] Reject duplicate tags inside the same union type
- [ ] Reject unknown alternative type identifiers
- [ ] Allow different tags to have the same alternative type
- [ ] Allow an alternative type to itself be a union type
- [ ] Reject direct recursive union definitions
- [ ] Reject indirect recursive union definitions

> [!CAUTION]
> Recursion through aliases still counts.

### 3.3 Type equivalence for unions

Assignments between union types are allowed when the left and right sides have
the same union type, including valid aliases.

Example:

```haskell
type
  A = union x:int, y:boolean end;
  B = A;
```

- [ ] Preserve existing type identifier and alias behaviour
- [ ] Allow assignment between the same union type or valid aliases
- [ ] Do not add broad structural equivalence unless the existing design does it
- [ ] Keep equality and inequality undefined for union types

> [!NOTE]
> Keep this aligned with the assignment's simpler name/alias equivalence rule.

### 3.4 Symbol table support for branch shadowing

Inside a branch like:

```haskell
unionswitch z on
  case num: z := z + 1
end
```

`z` temporarily behaves like the selected alternative type.

- [ ] Add any symbol table support needed for branch-local selector behaviour
- [ ] Make branch scopes restore the outer binding afterwards
- [ ] Avoid permanently changing the original variable entry
- [ ] Keep source locations useful for errors

> [!IMPORTANT]
> Branch shadowing is only for the branch. Outside the switch, the selector is
> still the union variable.

---

## 4. Static Checker

File:

- `StaticChecker.java`

### 4.1 Type-check union constructors

Need:

```haskell
id{tag, expression}
```

- [ ] Resolve the type identifier before `{...}`
- [ ] Make sure it names a union type
- [ ] Check the tag exists in that union
- [ ] Check the value expression
- [ ] Check the value expression matches the alternative type
- [ ] Set the constructor expression type to the union type
- [ ] Give clear errors for unknown union names
- [ ] Give clear errors for unknown tags
- [ ] Give clear errors for wrong value types

> [!IMPORTANT]
> A raw alternative value is not automatically a union value.

### 4.2 Type-check union casts

Need:

```haskell
z:tag
z:outer:inner
```

- [ ] Check the base expression/lvalue first
- [ ] Require the base to be a reference to a union type
- [ ] Check that the tag exists in the union type
- [ ] Set the cast result to the selected alternative reference type
- [ ] Allow the result to be used on the left side of assignment
- [ ] Support chained casts when the selected alternative is also a union type
- [ ] Give clear errors for casts on non-union values
- [ ] Give clear errors for unknown tags

> [!NOTE]
> Cast expressions must still behave like lvalues where the syntax allows it.

### 4.3 Type-check union switches

Need:

```haskell
unionswitch vid on
  case tag1: statements
  case tag2: statements
end
```

Checklist:

- [ ] Resolve the selector identifier
- [ ] Reject selectors that are not variables
- [ ] Reject selectors that are not union variables
- [ ] Collect all case labels
- [ ] Detect duplicate case labels
- [ ] Detect missing case labels
- [ ] Detect extra or unknown case labels
- [ ] Check that there is exactly one branch for every union tag
- [ ] Check each branch body in the correct branch context
- [ ] Restore the original selector type after each branch
- [ ] Restore the original selector type after the whole switch

> [!WARNING]
> Missing cases are static errors, not runtime fallthrough problems.

### 4.4 Make assignment rules union-safe

Examples:

```haskell
z := U{num, 4};       // good
z := 4;               // bad
z:num := 5;           // good only for the selected alternative type
y := z;               // good if y and z have the same union type
```

Checklist:

- [ ] Allow assignment between matching union types
- [ ] Allow assignment between valid union aliases
- [ ] Reject raw alternative values assigned directly into union variables
- [ ] Allow assignment through a valid union cast
- [ ] Keep scalar assignment behaviour unchanged
- [ ] Keep reference assignment behaviour unchanged
- [ ] Preserve value-copy behaviour for union assignment

> [!TIP]
> Most static bugs here will look like normal assignment bugs.

### 4.5 Error handling quality

- [ ] Use the best source location available for each semantic error
- [ ] Do not crash after syntax errors leave partial AST pieces
- [ ] Prefer specific messages for duplicate tags
- [ ] Prefer specific messages for unknown tags
- [ ] Prefer specific messages for missing cases
- [ ] Prefer specific messages for extra cases
- [ ] Match provided test outputs where possible
- [ ] Do not add random debugging text to compiler output

> [!CAUTION]
> Automated tests may be strict about output for provided cases.

---

## 5. Code Generation

File:

- `CodeGenerator.java`

### 5.1 Runtime representation

A union value needs runtime information for:

```haskell
selected tag + selected alternative value
```

Checklist:

- [ ] Allocate enough storage for the union tag
- [ ] Allocate enough storage for any alternative value
- [ ] Make variable allocation handle union values correctly
- [ ] Keep non-union allocation behaviour unchanged
- [ ] Support an invalid or unassigned union state where required by the spec

> [!WARNING]
> Unassigned union variables must fail casts and switches cleanly at runtime.

### 5.2 Generate union constructors

For:

```haskell
U{num, 4}
```

Checklist:

- [ ] Generate code for the alternative value expression
- [ ] Generate code that records the selected tag
- [ ] Generate a complete union value
- [ ] Make constructor output line up with assignment/expression code
- [ ] Keep constructor behaviour consistent for all alternatives

> [!IMPORTANT]
> Constructor output must be a union value, not just the inner value.

### 5.3 Generate union assignment/copying

Example to test:

```haskell
z := U{num, 105};
y := z;
z := U{bool, true};
```

After this, `y` should still contain the earlier copied union value.

Checklist:

- [ ] Assignment between union variables copies the union value
- [ ] Assignment does not accidentally share the original variable storage
- [ ] Reassigning one variable does not mutate earlier copies
- [ ] Assignment through casts updates the selected alternative value
- [ ] Non-union assignment code still behaves as before

> [!IMPORTANT]
> Union assignment has value semantics.

### 5.4 Generate union casts

For:

```haskell
z:tag
```

Runtime must:

- [ ] Check the current runtime tag
- [ ] Fail with `StackMachine.INVALID_UNION_CAST` if the tag mismatches
- [ ] Fail with `StackMachine.INVALID_UNION_CAST` if the union is unassigned
- [ ] Access the selected alternative value when the tag matches
- [ ] Work when reading through the cast
- [ ] Work when assigning through the cast

> [!NOTE]
> A cast is a checked access to the selected alternative value.

### 5.5 Generate union switch

For:

```haskell
unionswitch z on
  case num:  z := z * z
  case bool: z := false
  case sub:  z := 5
end
```

Checklist:

- [ ] Check the selector variable's runtime tag
- [ ] Fail with `StackMachine.INVALID_TAG` if the selector is unassigned/invalid
- [ ] Execute the branch matching the current tag
- [ ] Make selector access inside the branch use the selected alternative value
- [ ] Continue after the whole switch once the selected branch finishes
- [ ] Ensure every generated branch target is correct

> [!CAUTION]
> Static checking ensures branch coverage, but runtime still needs to catch an
> invalid or unassigned selector.

### 5.6 Selector behaviour during codegen

Inside each case branch:

- [ ] The selector behaves like the selected alternative value
- [ ] Reads use the selected alternative value
- [ ] Writes update the selected alternative value
- [ ] The selector behaves normally again after the branch
- [ ] The selector behaves normally again after the switch

> [!NOTE]
> Same source name, branch-specific meaning, then restored afterwards.

### 5.7 Nested union edge cases

- [ ] Constructor where an alternative value is itself a union
- [ ] Cast where the first selected alternative is another union
- [ ] Chained cast through nested union alternatives
- [ ] Switch branch where the selected alternative type is another union
- [ ] Union value copying when alternatives have different storage needs

> [!TIP]
> Nested unions are good final tests after the simple cases work.

---

## 6. Testing

### 6.1 Basic test order

- [ ] Run all provided base tests first
- [ ] Run all provided union tests
- [ ] Run tiny hand-written tests after every major feature
- [ ] If old tests break, check recent grammar/checker/codegen changes
- [ ] Run final tests from a clean rebuild
- [ ] Do not rely on stale generated parser files

> [!IMPORTANT]
> Regression tests matter because normal refs and assignments are easy to break
> while adding checked union references.

### 6.2 Syntax tests

- [ ] Valid union type declaration
- [ ] Union type with one alternative
- [ ] Union type with multiple alternatives
- [ ] Union constructor expression
- [ ] Union cast expression
- [ ] Chained union cast expression
- [ ] Assignment through union cast
- [ ] Union switch with all cases
- [ ] Old PL0 syntax still parses

### 6.3 Static checking tests

- [ ] Duplicate tags in one union type
- [ ] Unknown alternative type identifier
- [ ] Direct recursive union type
- [ ] Indirect recursive union type
- [ ] Constructor with valid tag and value type
- [ ] Constructor with unknown tag
- [ ] Constructor with wrong value type
- [ ] Raw alternative assignment into union variable is rejected
- [ ] Cast with valid tag
- [ ] Cast with unknown tag
- [ ] Cast on non-union value is rejected
- [ ] Union switch accepts exactly one case per tag
- [ ] Union switch rejects missing cases
- [ ] Union switch rejects extra cases
- [ ] Union switch rejects duplicate cases
- [ ] Selector behaves as alternative type inside branch
- [ ] Selector goes back to union type after switch
- [ ] Equality and inequality are rejected for union types
- [ ] Old PL0 static checking tests still pass

### 6.4 Runtime/codegen tests

- [ ] Union constructor stores the selected alternative correctly
- [ ] Assigning one union variable to another copies by value
- [ ] Reassigning source union does not mutate copied union
- [ ] Cast read succeeds when runtime tag matches
- [ ] Cast assignment updates the selected alternative value
- [ ] Cast fails with `INVALID_UNION_CAST` when tag mismatches
- [ ] Cast fails with `INVALID_UNION_CAST` when union is unassigned
- [ ] Union switch executes the right branch for each tag
- [ ] Union switch fails with `INVALID_TAG` when selector is unassigned
- [ ] Nested union cases behave correctly
- [ ] Old PL0 runtime/codegen tests still pass

---

## 7. Cleanup

- [ ] Remove debug prints
- [ ] Check imports for IDE garbage
- [ ] Check there are no imports outside `java.util.*`
- [ ] Make sure only allowed files were edited
- [ ] Check line lengths are sensible
- [ ] Do not reformat unrelated existing code
- [ ] Keep comments short and consistent with the existing codebase
- [ ] Avoid non-standard characters in comments
- [ ] Fix obvious comment typos introduced while working
- [ ] Check indentation of new code matches nearby code
- [ ] Regenerate parser files properly after final `PL0.cup` changes
- [ ] Check Java-CUP output for unexpected warnings/errors
- [ ] Do not manually patch generated parser files
- [ ] Run final tests from scratch
- [ ] Confirm all required files are ready
- [ ] Confirm no extra files are being submitted
- [ ] Confirm `UseOfAI.pdf` exists and has the required AI/MT statement

> [!WARNING]
> `UseOfAI.pdf` is required even if no AI or MT was used.