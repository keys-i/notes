# Static Semantics and Semantic Analysis

Static semantics checks whether the parsed AST is meaningful before execution. It does this by walking the AST with a **symbol table context** and checking expressions, statements, declarations, blocks, and scopes.

| **Check** | **Meaning** |
| --- | --- |
| Type correctness | Expressions and statements use compatible types |
| Identifier validity | Variables, constants, types, and procedures are declared |
| Assignment validity | The left side can be assigned to and the right side has the right type |
| Control-flow validity | `if` and `while` conditions must be boolean |
| Declaration validity | Constants, types, variables, and procedures are well formed |
| Scope validity | Local declarations are used correctly and cyclic definitions are rejected |

## Types

PL0 has scalar types, reference types, product types, and function types.

```haskell
T ::= int
    | boolean
    | subrange(T, lower, upper)
    | ref(T)
    | T × T
    | T → T
```

The main scalar types are:

```haskell
int
boolean
subrange(T, lower, upper)
```

For a subrange type:

```text
subrange(T, lower, upper)
```

the base type `T` must be either `int` or `boolean`, and the bounds must satisfy:

```text
lower ≤ upper
```

Reference types are used for variables. A variable of type `T` is usually stored in the symbol table with type:

```text
ref(T)
```

> [!note] Example: Variable Types
>
> ```pascal
> var x : int;
> ```
>
> gives:
>
> ```text
> x : ref(int)
> ```
>
> because variables represent storage locations.
>
> ```pascal
> type S = [-10 .. 10];
> var y : S;
> ```
>
> gives:
>
> ```text
> S : subrange(int, -10, 10)
> y : ref(subrange(int, -10, 10))
> ```
>
> A variable has a reference type because it can appear as a left-value in assignments. When used in an expression, it is usually dereferenced to get its stored value.

## Operator Types

Some PL0 operators are treated as functions.

| Operator | Type | Meaning |
| --- | --- | --- |
| `-_` | $\mathrm{int} \to \mathrm{int}$ | Unary integer negation |
| `_+_` | $\mathrm{int} \times \mathrm{int} \to \mathrm{int}$ | Integer addition |
| `_-_` | $\mathrm{int} \times \mathrm{int} \to \mathrm{int}$ | Integer subtraction |
| `_*_` | $\mathrm{int} \times \mathrm{int} \to \mathrm{int}$ | Integer multiplication |
| `_/_` | $\mathrm{int} \times \mathrm{int} \to \mathrm{int}$ | Integer division |
| `_=_` | $\mathrm{int} \times \mathrm{int} \to \mathrm{boolean}$ | Integer equality |
| `_=_` | $\mathrm{boolean} \times \mathrm{boolean} \to \mathrm{boolean}$ | Boolean equality |
| `_≠_` | $\mathrm{int} \times \mathrm{int} \to \mathrm{boolean}$ | Integer inequality |
| `_≠_` | $\mathrm{boolean} \times \mathrm{boolean} \to \mathrm{boolean}$ | Boolean inequality |
| `_< _` | $\mathrm{int} \times \mathrm{int} \to \mathrm{boolean}$ | Less than |
| `_≤_` | $\mathrm{int} \times \mathrm{int} \to \mathrm{boolean}$ | Less than or equal |
| `_>_` | $\mathrm{int} \times \mathrm{int} \to \mathrm{boolean}$ | Greater than |
| `_≥_` | $\mathrm{int} \times \mathrm{int} \to \mathrm{boolean}$ | Greater than or equal |

Equality and inequality are overloaded because they work on both integers and booleans.

## Symbol Tables and Scopes

A symbol table maps identifiers to semantic information.

```haskell
SymEntry ::= ConstEntry(T, v)
           | TypeEntry(T)
           | VarEntry(T)
           | ProcEntry(block)
```

| Entry | Meaning |
| --- | --- |
| $\mathrm{ConstEntry}(T,v)$ | Constant of type $T$ with value $v$ |
| $\mathrm{TypeEntry}(T)$ | Type name representing type $T$ |
| $\mathrm{VarEntry}(T)$ | Variable with type $T$, usually $\mathrm{ref}(T)$ |
| $\mathrm{ProcEntry}(\mathrm{block})$ | Procedure with a body block |

> [!note] Example: Symbol Table
>
> ```pascal
> const C = 42;
> type S = [-C .. C];
> var b : boolean;
>     y : S;
> ```
>
> has a symbol table like:
>
> ```text
> C ↦ ConstEntry(int, 42)
> S ↦ TypeEntry(subrange(int, -42, 42))
> b ↦ VarEntry(ref(boolean))
> y ↦ VarEntry(ref(subrange(int, -42, 42)))
> ```

## Static Semantics

### Expressions

The judgement:

```text
syms ⊢ e : T
```

means:

> In the symbol table context `syms`, expression `e` is well typed and has type `T`

| Rule | Expression form | Requirements | Result | Meaning |
| --- | --- | --- | --- | --- |
| *Integer value* | $n$ | $\begin{aligned} n &\in \mathbb{Z} \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash n : \mathrm{int} \end{aligned}$ | Integer literals have type `int` |
| *Symbolic constant* | $\mathit{id}$ | $\begin{aligned} \mathit{id} &\in \operatorname{dom}(\mathrm{syms}) \\ \mathrm{syms}(\mathit{id}) &= \mathrm{ConstEntry}(T,v) \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathit{id} : T \end{aligned}$ | A constant identifier has the type stored in the symbol table |
| *Variable identifier* | $\mathit{id}$ | $\begin{aligned} \mathit{id} &\in \operatorname{dom}(\mathrm{syms}) \\ \mathrm{syms}(\mathit{id}) &= \mathrm{VarEntry}(T) \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathit{id} : T \end{aligned}$ | A variable identifier has the type stored in the symbol table |
| *Unary negation* | $\operatorname{op}(-\_,e)$ | $\begin{aligned} \mathrm{syms} &\vdash e : \mathrm{int} \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \operatorname{op}(-\_,e) : \mathrm{int} \end{aligned}$ | Unary minus can only be applied to an integer expression |
| *Binary operator* | $\operatorname{op}(\_\odot\_,(e_1,e_2))$ | $\begin{aligned} \mathrm{syms} &\vdash e_1 : T_1 \\ \mathrm{syms} &\vdash e_2 : T_2 \\ \mathrm{syms} &\vdash \_\odot\_ : T_1 \times T_2 \to T_3 \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \operatorname{op}(\_\odot\_,(e_1,e_2)) : T_3 \end{aligned}$ | A binary operator is valid when both operands match the operator type |
| *Dereference* | $e$ | $\begin{aligned} \mathrm{syms} &\vdash e : \mathrm{ref}(T) \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash e : T \end{aligned}$ | A reference value can be used as the value it stores |
| *Widen subrange* | $e$ | $\begin{aligned} \mathrm{syms} &\vdash e : \mathrm{subrange}(T,i,j) \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash e : T \end{aligned}$ | A subrange value can be used as its base type |
| *Narrow subrange* | $e$ | $\begin{aligned} \mathrm{syms} &\vdash e : T \\ i &\leq j \\ T &\in \{\mathrm{int},\mathrm{boolean}\} \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash e : \mathrm{subrange}(T,i,j) \end{aligned}$ | A base type value can be treated as a subrange type when needed |

> [!note] Example: Expression Types
>
> Given:
>
> ```pascal
> const C = 42;
> type S = [-C .. C];
> var b : boolean;
>     y : S;
> ```
>
> the symbol table contains:
>
> ```text
> C ↦ ConstEntry(int, 42)
> S ↦ TypeEntry(subrange(int, -42, 42))
> b ↦ VarEntry(ref(boolean))
> y ↦ VarEntry(ref(subrange(int, -42, 42)))
> ```
>
> Example expression types:
>
> | Expression | Rules used | Type |
> | --- | --- | --- |
> | $27$ | Integer value | $\mathrm{int}$ |
> | $C$ | Symbolic constant | $\mathrm{int}$ |
> | $b$ | Variable identifier | $\mathrm{ref}(\mathrm{boolean})$ |
> | $-C$ | Symbolic constant, unary negation | $\mathrm{int}$ |
> | $-C + 27$ | Unary negation, integer value, binary operator | $\mathrm{int}$ |
> | $y$ as a location | Variable identifier | $\mathrm{ref}(\mathrm{subrange}(\mathrm{int},-42,42))$ |
> | $y$ as a value | Variable identifier, dereference | $\mathrm{subrange}(\mathrm{int},-42,42)$ |
> | $y$ as an integer | Variable identifier, dereference, widen subrange | $\mathrm{int}$ |
> | $27$ as type $S$ | Integer value, narrow subrange | $\mathrm{subrange}(\mathrm{int},-42,42)$ |

### Statements

The judgement:

```text
syms ⊢ WFStatement(s)
```

means:

> In the symbol table context `syms`, statement `s` is well formed

| Rule | Statement form | Requirements | Result | Meaning |
| --- | --- | --- | --- | --- |
| *Assignment* | $\operatorname{assign}(lv,e)$ | $\begin{aligned} \mathrm{syms} &\vdash lv : \mathrm{ref}(T) \\ \mathrm{syms} &\vdash e : T \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathrm{WFStatement}(\operatorname{assign}(lv,e)) \end{aligned}$ | The left side must be assignable and the right side must have the same value type |
| *Procedure call* | $\operatorname{call}(\mathit{id})$ | $\begin{aligned} \mathit{id} &\in \operatorname{dom}(\mathrm{syms}) \\ \mathrm{syms}(\mathit{id}) &= \mathrm{ProcEntry}(\mathrm{block}) \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathrm{WFStatement}(\operatorname{call}(\mathit{id})) \end{aligned}$ | The called identifier must be declared as a procedure |
| *Read* | $\operatorname{read}(lv)$ | $\begin{aligned} \mathrm{syms} &\vdash lv : \mathrm{ref}(T) \\ T &= \mathrm{int} \lor T = \mathrm{subrange}(\mathrm{int},i,j) \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathrm{WFStatement}(\operatorname{read}(lv)) \end{aligned}$ | A read statement must read into an integer location or integer subrange location |
| *Write* | $\operatorname{write}(e)$ | $\begin{aligned} \mathrm{syms} &\vdash e : \mathrm{int} \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathrm{WFStatement}(\operatorname{write}(e)) \end{aligned}$ | A write statement must output an integer expression |
| *Conditional* | $\operatorname{if}(e,s_1,s_2)$ | $\begin{aligned} \mathrm{syms} &\vdash e : \mathrm{boolean} \\ \mathrm{syms} &\vdash \mathrm{WFStatement}(s_1) \\ \mathrm{syms} &\vdash \mathrm{WFStatement}(s_2) \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathrm{WFStatement}(\operatorname{if}(e,s_1,s_2)) \end{aligned}$ | The condition must be boolean and both branches must be well formed |
| *Iteration* | $\operatorname{while}(e,s)$ | $\begin{aligned} \mathrm{syms} &\vdash e : \mathrm{boolean} \\ \mathrm{syms} &\vdash \mathrm{WFStatement}(s) \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathrm{WFStatement}(\operatorname{while}(e,s)) \end{aligned}$ | The loop condition must be boolean and the loop body must be well formed |
| *Statement list* | $\operatorname{list}(ls)$ | $\begin{aligned} \forall s \in \operatorname{elems}(ls) \bullet \mathrm{syms} &\vdash \mathrm{WFStatement}(s) \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathrm{WFStatement}(\operatorname{list}(ls)) \end{aligned}$ | A statement list is well formed if every statement inside it is well formed |

> [!note]
> Some notes use the narrower read rule:
>
> ```text
> syms ⊢ lv : ref(int)
> -------------------------
> syms ⊢ WFStatement(read(lv))
> ```
>
> Use whichever version your lecturer expects.

### Constant Expression Evaluation

Constant declarations need constant expressions that can be evaluated at compile time.

The judgement:

```text
syms ⊢ c e→ v
```

means:

> In the symbol table context `syms`, constant expression `c` evaluates to value `v`

| Rule | Constant expression | Requirements | Result | Meaning |
| --- | --- | --- | --- | --- |
| *Integer constant* | $n$ | $\begin{aligned} 0 &\leq n \leq \mathrm{maxint} \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash n \xrightarrow{e} n \end{aligned}$ | An integer constant evaluates to itself |
| *Constant identifier* | $\mathit{id}$ | $\begin{aligned} \mathit{id} &\in \operatorname{dom}(\mathrm{syms}) \\ \mathrm{syms}(\mathit{id}) &= \mathrm{ConstEntry}(T,v) \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathit{id} \xrightarrow{e} v \end{aligned}$ | A constant identifier evaluates to its stored value |
| *Negated constant* | $\operatorname{op}(-\_,c)$ | $\begin{aligned} \mathrm{syms} &\vdash c : \mathrm{int} \\ \mathrm{syms} &\vdash c \xrightarrow{e} v \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \operatorname{op}(-\_,c) \xrightarrow{e} -v \end{aligned}$ | A negated constant evaluates to the negative of its value |

### Well-Formed Types

The judgement:

```text
syms ⊢ typeof(t) = T
```

means:

> In the symbol table context `syms`, type expression `t` represents semantic type `T`

| Rule | Type form | Requirements | Result | Meaning |
| --- | --- | --- | --- | --- |
| *Type identifier* | $\mathit{id}$ | $\begin{aligned} \mathit{id} &\in \operatorname{dom}(\mathrm{syms}) \\ \mathrm{syms}(\mathit{id}) &= \mathrm{TypeEntry}(T) \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \operatorname{typeof}(\mathit{id}) = T \end{aligned}$ | A type identifier represents the type stored in the symbol table |
| *Subrange type* | $[c_0 \mathbin{..} c_1]$ | $\begin{aligned} \mathrm{syms} &\vdash c_0 : T \\ \mathrm{syms} &\vdash c_1 : T \\ \mathrm{syms} &\vdash c_0 \xrightarrow{e} v_0 \\ \mathrm{syms} &\vdash c_1 \xrightarrow{e} v_1 \\ v_0 &\leq v_1 \\ T &\in \{\mathrm{int},\mathrm{boolean}\} \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \operatorname{typeof}([c_0 \mathbin{..} c_1]) \\ &= \mathrm{subrange}(T,v_0,v_1) \end{aligned}$ | A subrange type is valid when both bounds have the same scalar base type and the lower bound is not greater than the upper bound |

### Declarations

The judgement:

```text
syms ⊢ WFDeclaration(d)
```

means:

> In the symbol table context `syms`, declaration `d` is well formed

The function:

```text
entry(syms, d) = ent
```

means:

> In the symbol table context `syms`, declaration `d` produces symbol table entry `ent`

| Rule | Declaration form | Requirements | Result | Meaning |
| --- | --- | --- | --- | --- |
| *Constant declaration* | $\operatorname{const}(c)$ | $\begin{aligned} \mathrm{syms} &\vdash c \xrightarrow{e} v \\ \mathrm{syms} &\vdash c : T \\ T &\in \{\mathrm{int},\mathrm{boolean}\} \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathrm{WFDeclaration}(\operatorname{const}(c)) \end{aligned}$ | A constant declaration is well formed when its expression can be evaluated and has type `int` or `boolean` |
| *Constant entry* | $\operatorname{const}(c)$ | $\begin{aligned} \mathrm{syms} &\vdash c \xrightarrow{e} v \\ \mathrm{syms} &\vdash c : T \\ T &\in \{\mathrm{int},\mathrm{boolean}\} \end{aligned}$ | $\begin{aligned} \operatorname{entry}(\mathrm{syms},\operatorname{const}(c)) &= \mathrm{ConstEntry}(T,v) \end{aligned}$ | A constant declaration produces a constant entry containing its type and value |
| *Type declaration* | $\operatorname{type}(t)$ | $\begin{aligned} \mathrm{syms} &\vdash \operatorname{typeof}(t) = T \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathrm{WFDeclaration}(\operatorname{type}(t)) \end{aligned}$ | A type declaration is well formed when its type expression is well formed |
| *Type entry* | $\operatorname{type}(t)$ | $\begin{aligned} \mathrm{syms} &\vdash \operatorname{typeof}(t) = T \end{aligned}$ | $\begin{aligned} \operatorname{entry}(\mathrm{syms},\operatorname{type}(t)) &= \mathrm{TypeEntry}(T) \end{aligned}$ | A type declaration produces a type entry containing the semantic type |
| *Variable declaration* | $\operatorname{var}(t)$ | $\begin{aligned} \mathrm{syms} &\vdash \operatorname{typeof}(t) = T \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathrm{WFDeclaration}(\operatorname{var}(t)) \end{aligned}$ | A variable declaration is well formed when its declared type is well formed |
| *Variable entry* | $\operatorname{var}(t)$ | $\begin{aligned} \mathrm{syms} &\vdash \operatorname{typeof}(t) = T \end{aligned}$ | $\begin{aligned} \operatorname{entry}(\mathrm{syms},\operatorname{var}(t)) &= \mathrm{VarEntry}(\mathrm{ref}(T)) \end{aligned}$ | A variable declaration produces a variable entry with reference type |
| *Procedure declaration* | $\operatorname{proc}(\mathrm{block})$ | $\begin{aligned} \mathrm{syms} &\vdash \mathrm{WFBlock}(\mathrm{block}) \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathrm{WFDeclaration}(\operatorname{proc}(\mathrm{block})) \end{aligned}$ | A procedure declaration is well formed when its body block is well formed |
| *Procedure entry* | $\operatorname{proc}(\mathrm{block})$ | $\begin{aligned} \mathrm{syms} &\vdash \mathrm{WFBlock}(\mathrm{block}) \end{aligned}$ | $\begin{aligned} \operatorname{entry}(\mathrm{syms},\operatorname{proc}(\mathrm{block})) &= \mathrm{ProcEntry}(\mathrm{block}) \end{aligned}$ | A procedure declaration produces a procedure entry containing its body block |

### Blocks and Scopes

A block has the form:

```text
blk(ds, s)
```

where `ds` is the declaration mapping and `s` is the body statement.

The judgement:

```text
syms ⊢ WFBlock(blk(ds, s))
```

means:

> In the symbol table context `syms`, the block `blk(ds, s)` is well formed

| Rule | Construct | Requirements | Result | Meaning |
| --- | --- | --- | --- | --- |
| *Well formed block* | $\operatorname{blk}(ds,s)$ | $\begin{aligned} ds_{\mathrm{uses}} &= \{id_1 \in \operatorname{dom}(ds),\ id_2 \in \operatorname{uses}(ds(id_1)) \bullet id_1 \mapsto id_2\} \\ \neg \exists id \in \operatorname{dom}(ds) &\bullet ((id \mapsto id) \in ds_{\mathrm{uses}}^{+}) \\ \mathrm{syms}' &= \mathrm{syms} \oplus \{id \in \operatorname{dom}(ds) \bullet id \mapsto \operatorname{entryDecl}(\mathrm{syms},ds,ds(id))\} \\ \forall id \in \operatorname{dom}(ds) &\bullet \mathrm{syms}' \vdash \mathrm{WFDeclaration}(ds(id)) \\ \mathrm{syms}' &\vdash \mathrm{WFStatement}(s) \end{aligned}$ | $\begin{aligned} \mathrm{syms} &\vdash \mathrm{WFBlock}(\operatorname{blk}(ds,s)) \end{aligned}$ | A block is well formed when its local declarations have no cycles, its local symbol table can be built, its declarations are well formed, and its body is well formed |
| *EntryDecl* | $\operatorname{entryDecl}(\mathrm{syms},ds,d)$ | $\begin{aligned} \mathrm{syms}' &= \mathrm{syms} \oplus \{id \in (\operatorname{dom}(ds) \cap \operatorname{uses}(d)) \bullet id \mapsto \operatorname{entryDecl}(\mathrm{syms},ds,ds(id))\} \end{aligned}$ | $\begin{aligned} \operatorname{entryDecl}(\mathrm{syms},ds,d) &= \operatorname{entry}(\mathrm{syms}',d) \end{aligned}$ | The symbol table entry for a declaration is built using the outer symbol table plus local declarations that the declaration depends on |
| *Declaration dependencies* | $ds_{\mathrm{uses}}$ | $\begin{aligned} id_1 &\in \operatorname{dom}(ds) \\ id_2 &\in \operatorname{uses}(ds(id_1)) \end{aligned}$ | $\begin{aligned} id_1 &\mapsto id_2 \end{aligned}$ | Records that declaration $id_1$ depends on identifier $id_2$ |
| *Cycle check* | $ds_{\mathrm{uses}}^{+}$ | $\begin{aligned} \neg \exists id \in \operatorname{dom}(ds) \bullet ((id \mapsto id) \in ds_{\mathrm{uses}}^{+}) \end{aligned}$ | $\begin{aligned} \text{No cyclic local declarations} \end{aligned}$ | A declaration must not depend directly or indirectly on itself |
| *Extended symbol table* | $\mathrm{syms}'$ | $\begin{aligned} \mathrm{syms}' &= \mathrm{syms} \oplus \mathrm{localEntries} \end{aligned}$ | $\begin{aligned} \text{Local declarations override outer declarations} \end{aligned}$ | The block body is checked using the extended symbol table |
| *Declaration checking* | $ds(id)$ | $\begin{aligned} \forall id \in \operatorname{dom}(ds) \bullet \mathrm{syms}' &\vdash \mathrm{WFDeclaration}(ds(id)) \end{aligned}$ | $\begin{aligned} \text{All local declarations are well formed} \end{aligned}$ | Every declaration in the block must be valid in the extended context |
| *Body checking* | $s$ | $\begin{aligned} \mathrm{syms}' &\vdash \mathrm{WFStatement}(s) \end{aligned}$ | $\begin{aligned} \text{The body statement is well formed} \end{aligned}$ | The block body must be valid using the local scope |

### The `uses` Function

The function `uses` finds which identifiers are needed to build a declaration’s symbol table entry.

| Construct | Used identifiers | Meaning |
| --- | --- | --- |
| $\operatorname{uses}(\operatorname{const}(c))$ | $\operatorname{uses}(c)$ | A constant declaration uses identifiers in its constant expression |
| $\operatorname{uses}(\operatorname{type}(t))$ | $\operatorname{uses}(t)$ | A type declaration uses identifiers in its type expression |
| $\operatorname{uses}(\operatorname{var}(t))$ | $\operatorname{uses}(t)$ | A variable declaration uses identifiers in its declared type |
| $\operatorname{uses}(\operatorname{proc}(\mathrm{block}))$ | $\varnothing$ | A procedure declaration does not use identifiers to build its own symbol table entry |
| $\operatorname{uses}(n)$ | $\varnothing$ | An integer literal uses no identifiers |
| $\operatorname{uses}(\mathit{id})$ | $\{\mathit{id}\}$ | An identifier expression uses that identifier |
| $\operatorname{uses}(\operatorname{op}(-\_,c))$ | $\operatorname{uses}(c)$ | A negated constant expression uses identifiers in the inner expression |
| $\operatorname{uses}([c_0 \mathbin{..} c_1])$ | $\operatorname{uses}(c_0) \cup \operatorname{uses}(c_1)$ | A subrange type uses identifiers in both bounds |

### Scope Rules

| Scope rule | Meaning |
| --- | --- |
| *Local declarations are visible inside the block* | Declarations in $ds$ are visible in the block body statement $s$ |
| *Local declarations can refer to each other* | A declaration may use another declaration from the same block if this does not create a cycle |
| *Inner declarations can shadow outer declarations* | If an inner block declares the same identifier as an outer block, the inner declaration is used inside the inner block |
| *A declaration set cannot contain duplicate identifiers* | Since $ds$ is a mapping $id \mapsto d$, each identifier can appear at most once in the same scope |
| *Cyclic constants and types are invalid* | Declarations such as `const N = M; M = -N;` or `type S = T; T = S;` are rejected |
| *Recursive procedures are allowed* | Procedure bodies may call themselves or other procedures because $\operatorname{uses}(\operatorname{proc}(\mathrm{block})) = \varnothing$ |
| *Procedure bodies have their own scope* | A procedure body is a nested block, so it can introduce new local declarations |

> [!note] Example: Cyclic Declarations
>
> | Declarations | Dependencies | Valid | Reason |
> | --- | --- | --- | --- |
> | `const N = M; M = -N;` | $N \mapsto M,\ M \mapsto N$ | No | $N$ depends on $M$ and $M$ depends on $N$ |
> | `type S = T; T = S;` | $S \mapsto T,\ T \mapsto S$ | No | $S$ and $T$ form a cyclic type definition |
> | `type S = [-10 .. 10]; var x : S;` | $x \mapsto S$ | Yes | $x$ depends on $S$ but there is no cycle |
> | `procedure p() = call p;` | No declaration-entry dependency | Yes | Recursive procedure calls are allowed |

### Main Program

A main program consists of a block. It is well formed when the block is well formed in the predefined symbol table.

The predefined symbol table is:

```text
predefined = {
  int     ↦ TypeEntry(int),
  boolean ↦ TypeEntry(boolean),
  false   ↦ ConstEntry(boolean, 0),
  true    ↦ ConstEntry(boolean, 1)
}
```

The compiler version may also include predefined operators in the predefined symbol table.

| Rule | Requirements | Result | Meaning |
| --- | --- | --- | --- |
| *Well formed main program* | $\begin{aligned} \mathrm{predefined} &\vdash \mathrm{WFBlock}(\mathrm{block}) \end{aligned}$ | $\begin{aligned} \mathrm{WFProgram}(\mathrm{block}) \end{aligned}$ | A program is well formed when its top-level block is well formed in the predefined context |
