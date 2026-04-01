# Assignment 1

> [!IMPORTANT]
> This is a easy-to-understand checklist based on the spec.
> It is just here as a sanity check.
> No implementation strategy, no sneaky hints, no extra help beyond what the
> assignment already says.

> [!NOTE]
> Due: 15:00 Friday 17 April 2026.
>
> Make sure you're working from the assignment `a1.zip` codebase, not a
> tutorial version or some older copy.

## What You're Actually Doing

- [ ] Extend the recursive descent PL0 compiler with set types.
- [ ] Add the required set operations.
- [ ] Add a `for` statement that iterates over a set.
- [ ] Keep an eye on Blackboard and Ed in case staff post updates or
      clarifications.

## Stuff You Really Don't Want To Mess Up

> [!WARNING]
> Easy marks to throw away if you're not paying attention.

- [ ] Only use imports from `java.util.*`.
- [ ] No random external imports have been added by the IDE.
- [ ] Only the required submission files have been changed.
- [ ] No unrelated files have been edited.
- [ ] Existing files have not been reformatted just because it looked nicer.
- [ ] Lines stay under 100 characters.
- [ ] Comments and source text use standard characters only.
- [ ] No debug output is left in the final submission.
- [ ] Tabs are either avoided or kept consistent with 4-space tab stops.

## Features You Need

- [ ] Set types can be declared.
- [ ] Variables can have set types.
- [ ] Set values can be written with set constructors.
- [ ] Assigning a set copies the value instead of sharing a reference.
- [ ] Sets of the same type can be compared with `=` and `!=`.
- [ ] Sets of the same type support `+`, `*`, and `-`.
- [ ] Unary `~` works as set complement.
- [ ] Binary `in` works for set membership.
- [ ] A `for` statement can iterate over the elements of a set.

## Syntax To Support

- [ ] `setof TypeIdentifier`
- [ ] `{ [Condition {, Condition}] }:TypeIdentifier`
- [ ] `~ Factor`
- [ ] `e in s`
- [ ] `for id : e do s`
- [ ] The tokens `{`, `}`, `~`, `for`, `in`, and `setof` are handled properly.
- [ ] Keywords are case-sensitive.

### Precedence And Associativity

- [ ] `~` binds tighter than `*`, `+`, and `-`.
- [ ] `*` binds tighter than `+` and `-`.
- [ ] `+` and `-` sit at the same precedence level.
- [ ] Union and subtraction are left associative.
- [ ] Intersection is left associative.
- [ ] Relational operators, including `=`, `!=`, and `in`, stay lower than the
      set operators above.

## Static Semantics

### Set Types

- [ ] The element type of a set type is a subrange type.
- [ ] That subrange has at most 32 values.
- [ ] Two set types count as equivalent when their element types are
      equivalent.

### Set Operators

For a declared set type `T = SetType(subrange(E, i, j))`:

| Operator | Required type |
| --- | --- |
| `=` | `T x T -> boolean` |
| `!=` | `T x T -> boolean` |
| `+` | `T x T -> T` |
| `*` | `T x T -> T` |
| `-` | `T x T -> T` |
| `in` | `E x T -> boolean` |
| `~` | `T -> T` |

- [ ] Those operator type rules are enforced.

### Set Constructors

- [ ] In `{e1, e2, ..., en}:id`, the name after `:` refers to a set type.
- [ ] Each element expression is well-typed.
- [ ] Each element expression is compatible with the set's element type.
- [ ] The whole constructor has the set type named after the `:`.

### For Statements

- [ ] In `for id : e do s`, the expression `e` is well-typed.
- [ ] The expression `e` has a set type.
- [ ] The control variable `id` behaves like a new variable local to that loop.
- [ ] It is fine to reuse a name that already exists outside the loop.
- [ ] Inside the loop body, that name refers to the control variable unless a
      nested `for` shadows it again.
- [ ] The control variable is read-only inside the loop body.

## Runtime Behaviour

### Set Values

- [ ] Set values use a bit-map representation.
- [ ] A set over a domain of at most 32 values fits in one 32-bit integer.
- [ ] Assigning a set copies its value.

### Set Constructors

- [ ] A set constructor evaluates to a set of the named set type.
- [ ] The result contains exactly the values produced by its element
      expressions.
- [ ] Repeated elements are fine and are not a runtime error.

### Set Operations

- [ ] Equality is true exactly when two sets contain the same elements.
- [ ] Inequality is true exactly when they do not contain the same elements.
- [ ] Union, intersection, subtraction, and complement all behave like the
      usual set operations.
- [ ] `e in s` is true exactly when the value of `e` is an element of `s`.
- [ ] Membership still behaves properly even if the left-hand value lands
      outside the set type's element subrange.

### For Statement Execution

- [ ] `for id : e do s` runs once for each element in the value of `e` at the
      start of the statement.
- [ ] Iteration happens in increasing order.
- [ ] If the set expression changes during the loop, that does not change the
      chosen iteration set.
- [ ] The control variable gets the matching element value at the start of each
      iteration.
- [ ] The `for` statement is the only thing allowed to modify the control
      variable.
- [ ] If booleans are involved, the ordering is `false = 0`, `true = 1`.

## Testing And Regression

> [!NOTE]
> Passing the supplied tests is handy, but it doesn't automatically mean the
> solution is fully right.

- [ ] Run the provided test programs.
- [ ] Re-run the existing `test-base*.pl0` tests.
- [ ] Check the new set and `for` tests.
- [ ] Make sure older compiler behaviour still works.
- [ ] Make sure syntax error recovery still works properly.

## Late And Extension Rules

- [ ] If you need an extension, request it through `my.UQ`.
- [ ] Treat the due date as 15:00 Friday 17 April 2026.
- [ ] The late penalty is 10% of the maximum mark per 24 hours for up to 7
      days.
- [ ] After 7 days late, the mark is 0.

## Submission Checklist

> [!CAUTION]
> Submit the individual files, not a `.zip` or any other archive.

> [!NOTE]
> AI and MT tools are allowed, but every use has to be clearly disclosed.

- [ ] Submit through the Blackboard assessment area.
- [ ] Only these files are modified and submitted:
  - [ ] `ExpNode.java`
  - [ ] `ExpTransform.java`
  - [ ] `Interpreter.java`
  - [ ] `Parser.java`
  - [ ] `StatementNode.java`
  - [ ] `StatementVisitor.java`
  - [ ] `StaticChecker.java`
  - [ ] `Type.java`
  - [ ] `UseOfAI.pdf`
- [ ] File names match exactly, including case.
- [ ] `UseOfAI.pdf` is actually a PDF.
- [ ] `UseOfAI.pdf` says whether AI and/or MT tools were used.
- [ ] `UseOfAI.pdf` clearly records every AI or MT use.
- [ ] Each AI/MT record includes:
  - [ ] the tool used
  - [ ] what it was used for
  - [ ] the prompts used
  - [ ] which part of the assignment it relates to
  - [ ] the date of use
- [ ] If you submit multiple times, the last submission is the intended one.

## Marking Sanity Check

- [ ] Be clear on the marking split:
  - [ ] 5 marks for syntax analysis, including error recovery, tree building,
        and symbol-table building
  - [ ] 5 marks for static semantics
  - [ ] 5 marks for the interpreter
- [ ] The compiler builds successfully.
- [ ] Syntax-analysis changes are correct and kept tight.
- [ ] Static-semantics changes are correct and kept tight.
- [ ] Interpreter changes are correct and kept tight.
- [ ] The code is readable.
- [ ] The code structure makes sense.
- [ ] The implementation is not more complicated than it needs to be.
- [ ] At least half of the new-feature tests are handled correctly.

> [!WARNING]
> The spec gives these mark caps:
>
> - If the submitted program does not compile: maximum 8/15.
> - If it does not correctly handle at least half the new-feature tests:
>   maximum 10/15.

## Conduct Checks

- [ ] The work is your own individual work.
- [ ] Your files are not readable by other users.
- [ ] No code has been copied from other students, past or present.
- [ ] No part of the solution has been posted anywhere others can access it.
- [ ] The assignment compiler and solution are not shared publicly.

## Final Pass

- [ ] All required features are covered.
- [ ] All the admin and submission constraints are sorted.
- [ ] The submission file list is correct.
- [ ] `UseOfAI.pdf` is ready.
- [ ] The final state matches what you actually want to submit.
