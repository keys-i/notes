# Tutorial 3

## Q1.
### Grammar:
```haskell
RepeatStatement -> KW_REPEAT StatementList KW_UNTIL Condition
```

### Parse Method:
```java
private void parseRepeatStatement() {
    tokens.match(Token.KW_REPEAT);
    parseStatementList();
    tokens.match(Token.KW_UNTIL);
    parseCondition();
}
```
## Q2.
```java
private void parseRepeatStatement(TokenSet recoverSet) {
    parse("RepeatStatement", Token.KW_REPEAT, recoverSet, () -> {
        tokens.match(Token.KW_REPEAT, StatementList.START_SET);
        parseStatementList(new TokenSet(Token.KW_UNTIL).union(recoverSet));
        tokens.match(Token.KW_UNTIL, CONDITION_START_SET.union(recoverSet));
        parseCondition(recoverSet);
    });
}
```

## Q3.
```java
private StatementNode parseRepeatStatement(TokenSet recoverSet) {
    return parse("RepeatStatement", Token.KW_REPEAT, recoverSet, () -> {
        Location loc = tokens.getLocation();
        tokens.match(Token.KW_REPEAT, StatementList.START_SET);
        StatementNode body =
            parseStatementList(new TokenSet(Token.KW_UNTIL).union(recoverSet));
        tokens.match(Token.KW_UNTIL, CONDITION_START_SET.union(recoverSet));
        ExpNode condition = parseCondition(recoverSet);
        return new RepeatNode(loc, body, condition);
    });
}
```
## Q4.
```haskell
BoolExpr   -> BoolTerm { OR BoolTerm }
BoolTerm   -> BoolFactor { AND BoolFactor }
BoolFactor -> NOT BoolFactor
           | "(" BoolExpr ")"
           | TRUE
           | FALSE
```
## Q5.

### Grammar:
```haskell
Condition -> LogTerm { ( LOG AND | LOG OR ) LogTerm }
LogTerm -> LOG NOT LogTerm | RelCondition
RelCondition -> Exp [ RelOp Exp ]
```

```java
private ExpNode parseCondition(TokenSet recoverSet) {
    return parse("Condition", CONDITION_START_SET, recoverSet, () -> {
        ExpNode left = parseLogTerm(
            new TokenSet(Token.LOG_AND, Token.LOG_OR).union(recoverSet)
        );

        while (tokens.isMatch(Token.LOG_AND) || tokens.isMatch(Token.LOG_OR)) {
            Token opTok = tokens.getToken();
            Operator op;

            if (tokens.isMatch(Token.LOG_AND)) {
                op = Operator.AND_OP;
                tokens.match(Token.LOG_AND, CONDITION_START_SET.union(recoverSet));
            } else {
                op = Operator.OR_OP;
                tokens.match(Token.LOG_OR, CONDITION_START_SET.union(recoverSet));
            }

            ExpNode right = parseLogTerm(
                new TokenSet(Token.LOG_AND, Token.LOG_OR).union(recoverSet)
            );

            left = new BinaryNode(opTok.getLocation(), op, left, right);
        }

        return left;
    });
}
```

```java
private ExpNode parseLogTerm(TokenSet recoverSet) {
    return parse("LogTerm", CONDITION_START_SET, recoverSet, () -> {
        if (tokens.isMatch(Token.LOG_NOT)) {
            Location loc = tokens.getLocation();
            tokens.match(Token.LOG_NOT, CONDITION_START_SET.union(recoverSet));
            ExpNode term = parseLogTerm(recoverSet);
            return new UnaryNode(loc, Operator.NOT_OP, term);
        } else {
            return parseRelCondition(recoverSet);
        }
    });
}
```