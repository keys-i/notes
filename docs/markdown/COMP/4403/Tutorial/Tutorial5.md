# Tutorial 5

## Q1
### (a.)
```haskell
lexp -> atom | list
atom -> NUM | ID
list -> ‘(’ lexpSeq‘)’
lexpSeq -> lexp lexpSeq'
lexpSeq' -> lexp lexpSeq' | ϵ
```

### (b.)
FIRST
```haskell
FIRST(lexp) = {NUM, ID, LPAREN} 
FIRST(atom) = {NUM, ID}
FIRST(list) = {LPAREN}  
FIRST(lexpSeq) = {NUM, ID, LPAREN}
FIRST(lexpSeq') = {NUM, ID, LPAREN, ϵ}
```

FOLLOW
```haskell
FOLLOW(lexp) = {$,NUM,ID,LPAREN,RPAREN}
FOLLOW(atom) = {$,NUM,ID,LPAREN,RPAREN}
FOLLOW(list) = {$,NUM,ID,LPAREN,RPAREN}
FOLLOW(lexpSeq) = {RPAREN}
FOLLOW(lexpSeq') = {RPAREN}
```

### (c.)
LL(1), since:
- $\text{FIRST(atom)} \cap \text{FIRST(list)} = \varnothing$
- ${\text{NUM},\text{ID}}$ are disjoint
- $\text{FIRST(lexp)} \cap \text{FOLLOW(lexpSeq')} = {\text{NUM},\text{ID},\text{LPAREN}} \cap {\text{RPAREN}} = \varnothing$
### (d.)

$$
\begin{aligned}  
\text{lexp} &\to \text{atom} \mid \text{list}\  
\text{atom} &\to \text{NUM} \mid \text{ID}\  
\text{list} &\to \text{LPAREN}\ \text{lexp}\ {\text{lexp}}\ \text{RPAREN}  
\end{aligned}  
$$

### (e.)
```java
private void parseLexp() {
    if (tokens.isMatch(Token.NUM) || tokens.isMatch(Token.ID)) {
        parseAtom();
    } else if (tokens.isMatch(Token.LPAREN)) {
        parseList();
    } else {
        match(Token.NUM); // force error
    }
}

private void parseAtom() {
    if (tokens.isMatch(Token.NUM)) {
        match(Token.NUM);
    } else if (tokens.isMatch(Token.ID)) {
        match(Token.ID);
    } else {
        match(Token.NUM); // force error
    }
}

private void parseList() {
    match(Token.LPAREN);
    parseLexp();
    while (tokens.isMatch(Token.NUM)
            || tokens.isMatch(Token.ID)
            || tokens.isMatch(Token.LPAREN)) {
        parseLexp();
    }
    match(Token.RPAREN);
}
```

### (f.)

```java
private Lexp parseLexp() {
    if (tokens.isMatch(Token.NUM) || tokens.isMatch(Token.ID)) {
        return parseAtom();
    } else if (tokens.isMatch(Token.LPAREN)) {
        return parseList();
    } else {
        return new Error();
    }
}

private Atom parseAtom() {
    if (tokens.isMatch(Token.NUM)) {
        int value = tokens.getNumber();
        match(Token.NUM);
        return new Number(value);
    } else if (tokens.isMatch(Token.ID)) {
        String name = tokens.getName();
        match(Token.ID);
        return new Identifier(name);
    } else {
        return new Error();
    }
}

private LList parseList() {
    List<Lexp> seq = new ArrayList<Lexp>();

    match(Token.LPAREN);
    seq.add(parseLexp());

    while (tokens.isMatch(Token.NUM)
            || tokens.isMatch(Token.ID)
            || tokens.isMatch(Token.LPAREN)) {
        seq.add(parseLexp());
    }

    match(Token.RPAREN);
    return new LList(seq);
}
```

---
## Q2
### (a)
$$
\begin{aligned}  
\text{Type} &\to \text{INT}\ \text{Type'}\  \newline
\text{Type'} &\to \text{LBRACKET}\ \text{RBRACKET}\ \text{Type'} \mid \varepsilon  
\end{aligned}  
$$

### (b.)
$$ 
\begin{aligned}  
\text{VarList} &\to \text{Ident}\ \text{VarList'}\  \newline
\text{VarList'} &\to \text{COMMA}\ \text{Ident}\ \text{VarList'} \mid \varepsilon  
\end{aligned}  
$$

Full grammar:  
$$
\begin{aligned}  
\text{Declaration} &\to \text{Type}\ \text{VarList}\ \newline
\text{Type} &\to \text{INT}\ \text{Type'}\  \newline
\text{Type'} &\to \text{LBRACKET}\ \text{RBRACKET}\ \text{Type'} \mid \varepsilon\ \newline 
\text{VarList} &\to \text{Ident}\ \text{VarList'}\  \newline
\text{VarList'} &\to \text{COMMA}\ \text{Ident}\ \text{VarList'} \mid \varepsilon\ \newline 
\text{Ident} &\to \text{ID}  
\end{aligned}  
$$

### (c.)
FIRST
$$
\begin{aligned}  
\text{FIRST(Declaration)} &= {\text{INT}}\  \newline
\text{FIRST(Type)} &= {\text{INT}}\  \newline
\text{FIRST(Type')} &= {\text{LBRACKET}, \varepsilon}\ \newline 
\text{FIRST(VarList)} &= {\text{ID}}\  \newline
\text{FIRST(VarList')} &= {\text{COMMA}, \varepsilon}\  \newline
\text{FIRST(Ident)} &= {\text{ID}}  
\end{aligned}  
$$

FOLLOW
$$
\begin{aligned}  
\text{FOLLOW(Declaration)} &= {$}\  \newline
\text{FOLLOW(Type)} &= {\text{ID}}\  \newline
\text{FOLLOW(Type')} &= {\text{ID}}\  \newline
\text{FOLLOW(VarList)} &= {$}\  \newline
\text{FOLLOW(VarList')} &= {$}\  \newline
\text{FOLLOW(Ident)} &= {\text{COMMA}, $}  
\end{aligned}  
$$

### (d.)
LL(1), since:

- $\text{FIRST(LBRACKET RBRACKET Type')} \cap \text{FOLLOW(Type')} = {\text{LBRACKET}} \cap {\text{ID}} = \varnothing$
- $\text{FIRST(COMMA Ident VarList')} \cap \text{FOLLOW(VarList')} = {\text{COMMA}} \cap {\$} = \varnothing$
### (e.)
$$
\begin{aligned}  
\text{Declaration} &\to \text{Type}\ \text{VarList}\  \newline
\text{Type} &\to \text{INT}\ {\text{LBRACKET}\ \text{RBRACKET}}\  \newline
\text{VarList} &\to \text{Ident}\ {\text{COMMA}\ \text{Ident}}\  \newline
\text{Ident} &\to \text{ID}  
\end{aligned}
$$

### (f.)

```java
private void parseDeclaration() {
    parseType();
    parseVarList();
}

private void parseType() {
    match(Token.INT);
    while (tokens.isMatch(Token.LBRACKET)) {
        match(Token.LBRACKET);
        match(Token.RBRACKET);
    }
}

private void parseVarList() {
    parseIdent();
    while (tokens.isMatch(Token.COMMA)) {
        match(Token.COMMA);
        parseIdent();
    }
}

private void parseIdent() {
    match(Token.ID);
}
```

### (g.)
```java
void parseDeclaration(SymTable syms) {
    TypeRep t = parseType();
    parseVarList(syms, t);
}

private TypeRep parseType() {
    if (!tokens.isMatch(Token.INT)) {
        return new ErrorType();
    }

    match(Token.INT);
    TypeRep t = new Int();

    while (tokens.isMatch(Token.LBRACKET)) {
        match(Token.LBRACKET);
        match(Token.RBRACKET);
        t = new Array(t);
    }

    return t;
}

private void parseVarList(SymTable syms, TypeRep t) {
    String name = parseIdent();
    if (!syms.contains(name)) {
        syms.add(name, t);
    }

    while (tokens.isMatch(Token.COMMA)) {
        match(Token.COMMA);
        name = parseIdent();
        if (!syms.contains(name)) {
            syms.add(name, t);
        }
    }
}

private String parseIdent() {
    String name = tokens.getName();
    match(Token.ID);
    return name;
}
```

---

## Q3
### (a.)
No.

### (b.)
No.

### (c.)
No. An unambiguous grammar need not be LL(1).