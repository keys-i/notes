# Tutorial 6

## Q1

```pascal
var
  x : int; y : int; max : int;
begin
  read x; read y;
  if x < y then
    max := y
  else
    max := x;
  write max
end
```

Assembly:

```asm
        READ 
        STORE 3          ; x := read()
        
        READ 
        STORE 4          ; y := read()
        
        LOAD 3           ; push x
        LOAD 4           ; push y
        LESS             ; push (x < y)
        
        BR_FALSE L1      ; if not (x < y) go to else
        
        LOAD 4           ; then: max := y
        STORE 5
        BR L2

L1:     LOAD 3           ; else: max := x
        STORE 5

L2:     LOAD 5
        WRITE            ; write max
```

## Q2

```pascal
var
  x : int; i : int;
begin
  i := 1;
  x := 0;
  while i < 5 do
  begin
    x := x + i * i;
    i := i + 1
  end;
  write x
end
```

Assembly:

```asm
        LOAD_CONST 1
        STORE 4          ; i := 1
        
        LOAD_CONST 0
        STORE 3          ; x := 1 
L1:     LOAD 4           ; i
        LOAD_CONST 5
        LESS             ; i < 5
        BR_FALSE L2
        
        LOAD 3           ; x
        LOAD 4           ; i
        LOAD 4           ; i
        MUL              ; i*i
        ADD              ; x+i*i
        STORE 3          ; x := x+i*i
      
        LOAD 4
        LOAD_CONST 1
        ADD
        STORE 4          ; i := i+1
        
        BR L1

L2:     LOAD 3
        WRITE
```

## Q3

### (a.)

```pascal
"repeat"    { return symbol(sym.KW_REPEAT); }
"until"     { return symbol(sym.KW_UNTIL); }
```

### (b.)

```pascal
terminal KW_REPEAT, KW_UNTIL;
```

### (c.)

```pascal
Statement ::=
      ...
    | KW_REPEAT StatementList KW_UNTIL Condition
        {: RESULT = new StatementNode.RepeatNode($2, $4); :}
    ;
```

### (d.)

```java
/**
* Repeat statement node
*/
public void visitRepeatNode(StatementNode.RepeatNode node) {
 beginCheck("Repeat");
 node.getLoopStmt().accept(this); // Check the body of the loop
 node.setCondition(visitBooleanExpNode(node.getCondition())); // Check the condition and replace with (possibly) transformed node
 endCheck("Repeat");
}
```

### (e.)

```java
/**
* Generate code for a "repeat" statement.
*/
public Code visitRepeatNode(StatementNode.RepeatNode node) {
 beginGen("Repeat");
 Code code = new Code();
 code.genComment("repeat:");

 code.append(node.getLoopStmt().genCode(this));
 code.append(node.getCondition().genCode(this));
 
 code.genJumpIfFalse(-(code.size() + Code.SIZE_JUMP_IF_FALSE));
 
 endGen("Repeat");
 return code;
}
```

## Q4

### (a.)

```pascal
"&&"    { return symbol(sym.AND_OP); }
"||"    { return symbol(sym.OR_OP); }
"!"     { return symbol(sym.NOT_OP); }
```

### (b.)

```pascal
terminal AND_OP, OR_OP, NOT_OP;
```

### (c.)

```pascal
non terminal Operator LogOp;
LogOp ::=
      AND_OP {: RESULT = Operator.AND_OP; :}
    | OR_OP  {: RESULT = Operator.OR_OP; :}
    ;
```

### (d.)

```java
AND_OP,
OR_OP,
NOT_OP,
```

### (e.)

```pascal
Condition ::= RelCondition:e
        {:
            RESULT = e;
        :}
    |  Condition:e1 LogOp:op RelCondition:e2
        {:
            RESULT = new ExpNode.BinaryNode(opxleft, op, e1, e2);
        :}
    ;

LogOp ::= OR
        {:
            RESULT = Operator.OR_OP;
        :}
    |  AND
        {:
            RESULT = Operator.AND_OP;
        :}
    ;

```

### (f.)

```pascal
UnaryOperator ::= MINUS
  {:
   RESULT = Operator.NEG_OP;
  :}
 | NOT
  {:
   RESULT = Operator.NOT_OP;
  :}
 ;
```

### (g.)

```java
FunctionType LOGICAL_UNARY = new FunctionType(BOOLEAN_TYPE, BOOLEAN_TYPE);
predefined.addOperator(Operator.OR_OP, ErrorHandler.NO_LOCATION, LOGICAL_BINARY);
predefined.addOperator(Operator.AND_OP, ErrorHandler.NO_LOCATION, LOGICAL_BINARY);
predefined.addOperator(Operator.NOT_OP, ErrorHandler.NO_LOCATION, LOGICAL_UNARY);
```

### (h.)

```java
case AND_OP -> {
    code = left.genCode(this);
    code.generateOp(Operation.DUP);
    Code rightCode = right.genCode(this);
    code.genJumpIfFalse(Operation.POP.getSize() + rightCode.size());
    code.generateOp(Operation.POP);
    code.append(rightCode);
}
case OR_OP -> {
    code = left.genCode(this);
    code.generateOp(Operation.DUP);
    Code rightCode = right.genCode(this);
    code.genJumpIfTrue(Operation.POP.getSize() + rightCode.size());
    code.generateOp(Operation.POP);
    code.append(rightCode);
}
```

### (i.)

```java
case NOT_OP ->
    code.genBoolNot();
```
