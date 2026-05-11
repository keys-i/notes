# Top-down Parsing

## BNF and EBNF

#### BNF (Backus-Naur form)

It lets multiple alternatives for the same nonterminal be written on one line using $\mid$
Instead of:

$$
\begin{align}
N &\rightarrow \alpha_1 \\
N &\rightarrow \alpha_2 \\
N &\rightarrow \alpha_3 \\
N &\rightarrow \alpha_4
\end{align}
$$

write:

$$
N \rightarrow \alpha_1 \mid \alpha_2 \mid \alpha_3 \mid \alpha_4
$$

#### EBNF (Extended BNF)

It extends BNF with shorthand notation for common patterns.

| Notation | Name                         | Meaning                                  | Example                                                         |
| -------- | ---------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| `[S]`    | Optional syntactic construct | $S$ may appear once or not appear at all | $RelCondition \rightarrow Exp\ [RelOp\ Exp]$                    |
| `{S}`    | Repetition construct         | $S$ may appear zero or more times        | $StatementList \rightarrow Statement\ \{SEMICOLON\ Statement\}$ |
| `(S)`    | Grouping construct           | Treat $S$ as one grouped unit            | $Term \rightarrow Factor\ \{(TIMES \mid DIVIDE)\ Factor\}$      |

## Recursive Descent Parsing

It is a top-down parsing method where the parser is written as a set of recursive methods.

Each **nonterminal** in the grammar gets its own parsing method.

> [!NOTE] Example
>
> $$
> RelCondition \rightarrow Exp\ [RelOp\ Exp]
> $$
>
> would be handled by a method like:
>
> ```java
> parseRelCondition();
> ```

The parser reads a stream of lexical tokens from left to right. As each method recognises part of the input, it moves the current token forward. When the method finishes, the current token should be the token immediately after the construct it parsed.

## LL(1) Parsing

It is a form of predictive recursive-descent parsing. Recursive-descent parsing works cleanly with this grammar.

| Part     | Meaning                              |
| -------- | ------------------------------------ |
| First L  | the input is read from left to right |
| Second L | produces a _leftmost_ derivation     |
| 1        | Use one token of lookahead           |

### First and Follow Sets

| FIRST(S)                                                | FOLLOW(N)                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| The set of tokens that can appear at **start** of $S$   | The set of tokens that can appear **immediately after** nonterminal $N$ |
| Choosing which grammar alternative to parse             | Deciding when a nullable/optional construct should stop or be skipped   |
| If $S \rightarrow NUMBER$, then $FIRST(S) = \{NUMBER\}$ | If $A \rightarrow N\ SEMICOLON$, then $SEMICOLON \in FOLLOW(N)$         |

## Left factoring and Left recursion removal

| Left factoring                                                                       | Left Recursion Removal                                                                                      |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Two or more alternatives start the same way                                          | A rule calls itself first on the right-hand side                                                            |
| The parser sees the same first token and cannot choose which alternative to use      | Recursive descent would call the same parse method again before consuming input, causing infinite recursion |
| $A \rightarrow \alpha\beta_1 \mid \alpha\beta_2$                                     | $A \rightarrow A\alpha \mid \beta$                                                                          |
| $A \rightarrow \alpha A^{\prime} \qquad A^{\prime} \rightarrow \beta_1 \mid \beta_2$ | $A \rightarrow \beta A^{\prime} \qquad A^{\prime} \rightarrow \alpha A^{\prime} \mid \epsilon$              |

## Implementation details

### Error recovery

how a parser continues after finding a syntax error.

| Strategy        | Local error recovery                                                                                             | Parse method synchronisation                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Purpose**     | Recover from a small error when one specific token was expected                                                  | Recover when a whole grammar construct cannot be parsed cleanly               |
| **Where used**  | `tokens.match(...)` when matching a terminal token                                                               | `parseN(...)` or a wrapper like `parse("N", expected, recoverSet, ...)`       |
| **Method form** | `tokens.match(expected, follows)`                                                                                | `parse("N", expected, recoverSet, () -> recog(N))`                            |
| **Key set**     | `follows`: tokens that can legally appear after the expected token                                               | `recoverSet`: tokens where it is safe to resume after this parse method       |
| **Handles**     | Missing expected token, extra inserted token, or one wrong replacement token                                     | Invalid tokens before a construct starts or leftover bad tokens after it ends |
| **Action**      | Match if correct; otherwise use `follows` to decide whether to assume missing, skip extra, or accept replacement | Skip tokens until reaching either a valid start token or a recovery token     |
| **Example**     | `match(KW_DO, STATEMENT_START_SET)`                                                                              | `parse("RelCondition", START_SET, recoverSet, ...)`                           |

### AST construction

Not sure what to put here
