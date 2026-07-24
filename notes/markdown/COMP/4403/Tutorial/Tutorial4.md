# Tutorial 4

## Q1

### (a.)

File: `src/parse/Parser.java`

```java
 * CompoundStatement -> KW_BEGIN StatementList KW_END
 * StatementList -> Statement { SEMICOLON Statement }
 * Statement -> RepeatStatement | WhileStatement | IfStatement |
 *          CallStatement | Assignment | ReadStatement |
 *          WriteStatement | CompoundStatement
 * Assignment -> LValue ASSIGN Condition
 * RepeatStatement -> KW_REPEAT StatementList KW_UNTIL Condition
 * WhileStatement -> KW_WHILE Condition KW_DO Statement
 * IfStatement -> KW_IF Condition KW_THEN Statement KW_ELSE Statement
```

### (b.)

File: `src/parse/Parser.java`

```java
private final static TokenSet STATEMENT_START_SET =
        LVALUE_START_SET.union(Token.KW_REPEAT, Token.KW_WHILE, Token.KW_IF,
                Token.KW_READ, Token.KW_WRITE,
                Token.KW_CALL, Token.KW_BEGIN);
```

### (c.)

File: `src/parse/Parser.java`

```java
private StatementNode parseStatement(TokenSet recoverSet) {
    return stmt.parse("Statement", STATEMENT_START_SET, recoverSet,
            () -> {
                switch (tokens.getKind()) {
                    case IDENTIFIER -> {
                        return parseAssignment(recoverSet);
                    }
                    case KW_REPEAT -> {
                        return parseRepeatStatement(recoverSet);
                    }
                    case KW_WHILE -> {
                        return parseWhileStatement(recoverSet);
                    }
                    case KW_IF -> {
                        return parseIfStatement(recoverSet);
                    }
                    case KW_READ -> {
                        return parseReadStatement(recoverSet);
                    }
                    case KW_WRITE -> {
                        return parseWriteStatement(recoverSet);
                    }
                    case KW_CALL -> {
                        return parseCallStatement(recoverSet);
                    }
                    case KW_BEGIN -> {
                        return parseCompoundStatement(recoverSet);
                    }
                    default -> {
                        fatal("parseStatement");
                        return new StatementNode.ErrorNode(tokens.getLocation());
                    }
                }
            });
}
```

### (d.)

File: `src/parse/Parser.java`

```java
private StatementNode parseRepeatStatement(TokenSet recoverSet) {
    return stmt.parse("Repeat Statement", Token.KW_REPEAT, recoverSet,
            () -> {
                tokens.match(Token.KW_REPEAT); /* cannot fail */
                Location loc = tokens.getLocation();
                StatementNode statement =
                        parseStatementList(recoverSet.union(Token.KW_UNTIL));
                tokens.match(Token.KW_UNTIL, CONDITION_START_SET);
                ExpNode cond = parseCondition(recoverSet);
                return new StatementNode.RepeatNode(loc, statement, cond);
            });
}
```

### (e.)

File: `src/tree/StatementNode.java`

Note: this is the final version, so the `accept` body is already enabled again for Q2(b).

```java
public static class RepeatNode extends StatementNode {
    private final StatementNode loopStmt;
    private ExpNode condition;

    public RepeatNode(Location loc, StatementNode loopStmt,
                      ExpNode condition) {
        super(loc);
        this.loopStmt = loopStmt;
        this.condition = condition;
    }

    @Override
    public void accept(StatementVisitor visitor) {
        visitor.visitRepeatNode(this);
    }

    public StatementNode getLoopStmt() {
        return loopStmt;
    }

    public ExpNode getCondition() {
        return condition;
    }

    public void setCondition(ExpNode condition) {
        this.condition = condition;
    }

    @Override
    public String toString(int level) {
        return "REPEAT" +
                newLine(level + 1) + loopStmt.toString(level + 1) +
                newLine(level) + "UNTIL " + condition.toString();
    }
}
```

## Q2

### (a.)

File: `src/tree/StatementVisitor.java`

```java
public interface StatementVisitor {

    void visitBlockNode(StatementNode.BlockNode node);

    void visitStatementErrorNode(StatementNode.ErrorNode node);

    void visitStatementListNode(StatementNode.ListNode node);

    void visitAssignmentNode(StatementNode.AssignmentNode node);

    void visitReadNode(StatementNode.ReadNode node);

    void visitWriteNode(StatementNode.WriteNode node);

    void visitCallNode(StatementNode.CallNode node);

    void visitIfNode(StatementNode.IfNode node);

    void visitWhileNode(StatementNode.WhileNode node);

    void visitRepeatNode(StatementNode.RepeatNode node);
}
```

### (b.)

File: `src/tree/StatementNode.java`

```java
@Override
public void accept(StatementVisitor visitor) {
    visitor.visitRepeatNode(this);
}
```

### (c.)

File: `src/tree/StaticChecker.java`

```java
public void visitRepeatNode(StatementNode.RepeatNode node) {
    beginCheck("Repeat");
    node.getLoopStmt().accept(this);  // Check the body of the loop
    node.setCondition(visitBooleanExpNode(node.getCondition()));
    endCheck("Repeat");
}
```

## Q3

### (a.)

File: `src/interpreter/Interpreter.java`

```java
public void visitRepeatNode(StatementNode.RepeatNode node) {
    beginExec("Repeat");
    ExpNode condition = node.getCondition();
    do {
        node.getLoopStmt().accept(this);
    } while (condition.evaluate(this).getInteger() != Predefined.TRUE_VALUE);
    endExec("Repeat");
}
```

## Q4

File: `src/tree/Operator.java`

```java
public enum Operator {
    /* Binary operators */
    ADD_OP("_+_"),
    SUB_OP("_-_"),
    MUL_OP("_*_"),
    DIV_OP("_/_"),
    EQUALS_OP("_=_"),
    NEQUALS_OP("_!=_"),
    GREATER_OP("_>_"),
    LESS_OP("_<_"),
    LEQUALS_OP("_<=_"),
    GEQUALS_OP("_>=_"),
    AND_OP("_&&_"),
    OR_OP("_||_"),
    /* unary operators */
    NEG_OP("-_", 1),
    NOT_OP("!_", 1),
    INVALID_OP("INVALID");
```

File: `src/parse/Parser.java`

```java
private final static TokenSet NOT_CONDITION_START_SET =
        REL_CONDITION_START_SET.union(Token.LOG_NOT);
private final static TokenSet AND_CONDITION_START_SET =
        NOT_CONDITION_START_SET;
private final static TokenSet CONDITION_START_SET =
        AND_CONDITION_START_SET;

private final static TokenSet COND_OPS_SET =
        new TokenSet(Token.LOG_OR);
private final static TokenSet AND_OPS_SET =
        new TokenSet(Token.LOG_AND);

private ExpNode parseCondition(TokenSet recoverSet) {
    return exp.parse("Condition", CONDITION_START_SET, recoverSet,
            () -> {
                ExpNode cond = parseAndCondition(recoverSet.union(COND_OPS_SET));
                while (tokens.isMatch(Token.LOG_OR)) {
                    Location loc = tokens.getLocation();
                    tokens.match(Token.LOG_OR); /* cannot fail */
                    ExpNode right =
                            parseAndCondition(recoverSet.union(COND_OPS_SET));
                    cond = new ExpNode.BinaryNode(loc, Operator.OR_OP, cond, right);
                }
                return cond;
            });
}

private ExpNode parseAndCondition(TokenSet recoverSet) {
    return exp.parse("AndCondition", AND_CONDITION_START_SET, recoverSet,
            () -> {
                ExpNode cond = parseNotCondition(recoverSet.union(AND_OPS_SET));
                while (tokens.isMatch(Token.LOG_AND)) {
                    Location loc = tokens.getLocation();
                    tokens.match(Token.LOG_AND); /* cannot fail */
                    ExpNode right =
                            parseNotCondition(recoverSet.union(AND_OPS_SET));
                    cond = new ExpNode.BinaryNode(loc, Operator.AND_OP, cond, right);
                }
                return cond;
            });
}

private ExpNode parseNotCondition(TokenSet recoverSet) {
    return exp.parse("NotCondition", NOT_CONDITION_START_SET, recoverSet,
            () -> {
                if (tokens.isMatch(Token.LOG_NOT)) {
                    Location loc = tokens.getLocation();
                    tokens.match(Token.LOG_NOT); /* cannot fail */
                    ExpNode cond = parseNotCondition(recoverSet);
                    return new ExpNode.UnaryNode(loc, Operator.NOT_OP, cond);
                }
                return parseRelCondition(recoverSet);
            });
}
```

Test files: `test-pgm/test-logop.pl0`, `test-pgm/test-logopx.pl0`

## Q5

File: `src/syms/Predefined.java`

```java
ProductType PAIR_INTEGER_TYPE = new ProductType(INTEGER_TYPE, INTEGER_TYPE);
ProductType PAIR_BOOLEAN_TYPE = new ProductType(BOOLEAN_TYPE, BOOLEAN_TYPE);
FunctionType ARITHMETIC_BINARY = new FunctionType(PAIR_INTEGER_TYPE, INTEGER_TYPE);
FunctionType INT_RELATIONAL_TYPE = new FunctionType(PAIR_INTEGER_TYPE, BOOLEAN_TYPE);
FunctionType LOGICAL_BINARY = new FunctionType(PAIR_BOOLEAN_TYPE, BOOLEAN_TYPE);
FunctionType ARITHMETIC_UNARY = new FunctionType(INTEGER_TYPE, INTEGER_TYPE);
FunctionType LOGICAL_UNARY = new FunctionType(BOOLEAN_TYPE, BOOLEAN_TYPE);

predefined.addOperator(Operator.EQUALS_OP, ErrorHandler.NO_LOCATION, LOGICAL_BINARY);
predefined.addOperator(Operator.NEQUALS_OP, ErrorHandler.NO_LOCATION, LOGICAL_BINARY);
predefined.addOperator(Operator.AND_OP, ErrorHandler.NO_LOCATION, LOGICAL_BINARY);
predefined.addOperator(Operator.OR_OP, ErrorHandler.NO_LOCATION, LOGICAL_BINARY);
predefined.addOperator(Operator.NEG_OP, ErrorHandler.NO_LOCATION, ARITHMETIC_UNARY);
predefined.addOperator(Operator.NOT_OP, ErrorHandler.NO_LOCATION, LOGICAL_UNARY);
```

## Q6

File: `src/interpreter/Interpreter.java`

```java
case AND_OP -> {
    if (left == Predefined.FALSE_VALUE) {
        result = Predefined.FALSE_VALUE;
    } else {
        int right = node.getRight().evaluate(this).getInteger();
        result = left & right;
    }
}
case OR_OP -> {
    if (left == Predefined.TRUE_VALUE) {
        result = Predefined.TRUE_VALUE;
    } else {
        int right = node.getRight().evaluate(this).getInteger();
        result = left | right;
    }
}
```

File: `src/interpreter/Interpreter.java`

```java
public Value visitUnaryNode(ExpNode.UnaryNode node) {
    beginExec("Unary");
    int result = node.getArg().evaluate(this).getInteger();
    switch (node.getOp()) {
        case NEG_OP ->
            result = -result;
        case NOT_OP ->
            result = (result == Predefined.TRUE_VALUE)
                    ? Predefined.FALSE_VALUE : Predefined.TRUE_VALUE;
        default ->
            errors.fatal("PL0 Internal error: Unknown operator", node.getLocation());
    }
    endExec("Unary");
    return new IntegerValue(result);
}
```

## Q7

File: `src/interpreter/Interpreter.java`

```java
case AND_OP -> {
    if (left == Predefined.FALSE_VALUE) {
        result = Predefined.FALSE_VALUE;
    } else {
        int right = node.getRight().evaluate(this).getInteger();
        result = left & right;
    }
}
case OR_OP -> {
    if (left == Predefined.TRUE_VALUE) {
        result = Predefined.TRUE_VALUE;
    } else {
        int right = node.getRight().evaluate(this).getInteger();
        result = left | right;
    }
}
```

These branches short-circuit because the right-hand side is only evaluated when the left-hand side does not already determine the final result.
