# Tutorial 9

## Q1

Types: $T::= \operatorname{int} \mid \operatorname{string}$
Integer can be converted to strings: $int \le string$ but strings cannot be converted to integers. The language has integer addition, string concatenation, identifiers, and `let` expressions.

### Type Rules

| Type          | Rule                                                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integer       | $\frac{}{\operatorname{syms} \vdash \operatorname{n} : int}$                                                                                                                     |
| String        | $\frac{}{\operatorname{syms} \vdash s : string}$                                                                                                                                 |
| Identifier    | $\frac{\operatorname{syms}(id)=\operatorname{ConstEntry}(T,v)} {\operatorname{syms}\vdash id:T}$                                                                                 |
| Addition      | $\frac{ \operatorname{syms}\vdash e_1:int \qquad \operatorname{syms}\vdash e_2:int }{ \operatorname{syms}\vdash e_1+e_2:int }$                                                   |
| Concatenation | $\frac{ \operatorname{syms}\vdash e_1:T_1 \qquad \operatorname{syms}\vdash e_2:T_2 \qquad T_1 \le string \qquad T_2 \le string }{ \operatorname{syms}\vdash e_1 ++ e_2:string }$ |

Let

$$
\frac{\operatorname{syms}\vdash e_1:T_1 \qquad \operatorname{syms}' = \operatorname{syms}\oplus\{id \mapsto \operatorname{ConstEntry}(T_1, v_1)\} \qquad \operatorname {syms}\vdash e_1 ++ e_2:string}{\operatorname{syms}\vdash let\ id=e_1\ in\ e_2\ end:T_2}
$$

### Evaluation Rules

| Type          | Rule                                                                                                                                                                                                                                 |     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| Integer       | $\frac{}{\operatorname{syms}\vdash n \rightarrow n}$                                                                                                                                                                                 |     |
| String        | $\frac{}{\operatorname{syms}\vdash s \rightarrow s}$                                                                                                                                                                                 |     |
| Identifier    | $\frac{\operatorname{syms}(id)=\operatorname{ConstEntry}(T,v)} {\operatorname{syms}\vdash id \rightarrow v}$                                                                                                                         |     |
| Addition      | $\frac{ \operatorname{syms}\vdash e_1 \rightarrow n_1 \qquad \operatorname{syms}\vdash e_2 \rightarrow n_2 }{ \operatorname{syms}\vdash e_1+e_2 \rightarrow n_1+n_2}$                                                                |     |
| Concatenation | $\frac{ \operatorname{syms}\vdash e_1 \rightarrow v_1 \qquad \operatorname{syms}\vdash e_2 \rightarrow v_2}{ \operatorname{syms}\vdash e_1 ++ e_2\ \rightarrow\ \operatorname{toString}(v_1) \frown\ \operatorname{toString}(v_2) }$ |     |

where `toString` converts integers to strings and leaves strings unchanged.

Let:

$$
\frac{\operatorname{syms}\vdash e_1 \rightarrow v_1 \qquad \operatorname{syms}\vdash e_2 \rightarrow v_2 \qquad \operatorname{syms}' = \operatorname{syms} \oplus \{id \mapsto \operatorname{ConstEntry}(T_1,v_1)\} \qquad \operatorname{syms}' \vdash e_2 \rightarrow v_2}{\operatorname{syms}\vdash let\ id = e_1\ in\ e_2\ end \rightarrow v_2 }
$$

## Q2

Grammar:

```haskell
TDS -> KW TYPE D DS
DS  -> D DS | ε
D   -> ID EQUALS T SEMICOLON
```

### Recursive Descent Parsing

```java
SymTab parseTDS(SymTab symsIn) {
	match(KW_TYPE);
	symsIn = parseD(symsIn);
	symsIn = parseDS(symsIn);
	return symsIn;
}

SymTab parseDS(SymTab symsIn) {
	if (token.isMatch(ID)) {
		symsIn = parseD(symsIn);
		symsIn = parseDS(symsIn);
	}
	return symsIn;
}

SymTab parseD(SymTab symsIn) {
	String id = token.getName();

	match(ID);
	match(EQUALS);
	Type t = parseT(symsIn);
	match(SEMICOLON);

	if (symsIn.contains(id)) {
		error("Duplicate declaration of " + id);
		return symsIn;
	}

	return symsIn.add(id, t);
}
```

#### Purely functional:

```haskell
parseTDS :: SymTab -> Parser SymTab
parseTDS symsIn = do
	match KW_TYPE
	syms1 <- parseDS symsIn
	syms2 <- parseD syms1
	return syms2

parseDS :: SymTab -> Parser SymTab
parseDS symsIn = do
	if isMatch lookahead id then do
		syms1 <- parseD symsIn
		parseDS syms1
	else
		return symsIn

parseD :: SymTab -> Parser SymTab
parseD symsIn = do
	token <- lookahead
	let idName =
			case token of
				ID name -> name
				_       -> error "Expected identifier"

	match IDToken
	match Equals

	t <- parseT symsIn

	match Semicolon

	if contains idName symsIn then do
		parseError ("Duplicate declaration of " ++ idName)
		return symsIn
	else
		return (add idName t symsIn)
```
