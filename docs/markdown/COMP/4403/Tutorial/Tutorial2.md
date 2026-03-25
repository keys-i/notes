# Tutorial 2

## Q1
### a.
#### i.
```haskell
A -> A “:” N | N
N -> 0 | 1
```
##### Language
All strings are of the form
$$
L = \{\,b_1:b_2\cdots:b_k \mid k \ge 1,\; b_i \in \{0,1\}\,\}

$$
##### Equivalent Regex
```regex
(0|1)(:(0|1))*
```
#### ii.
```haskell
A -> A N | ϵ
N -> 0 | 1
```
##### Language
All strings are of the form
$$
L = \{\; w \mid w \in \{0,1\}^*\;\}
$$
##### Equivalent Regex
```regex
(0|1)*
```
#### iii.
```haskell
A -> A A | N
N -> 0 | 1
```
##### Language
All strings are of the form
$$
L=\{\; w \mid w \in \{0,1\}^+ \;\}
$$
##### Equivalent Regex
```regex
(0|1)+
```
#### iv.
```haskell
A -> A N | N | ϵ
N -> 0 | 1
```
##### Language
All strings are of the form
$$
L=\{\; w \mid w \in \{0,1\}^* \;\}
$$
##### Equivalent Regex
```regex
(0|1)*
```

### b.
#### i. It has a fixed separator ":"
#### ii. it applies the same operation for any length input
#### iii.
Left Tree
```mermaid
graph TD

%% L1 %%
Aroot[A] --> Ai1[A]
Aroot[A] --> Ai2[A]

%% L1-1 %%
subgraph L
Ai1[A] --> Aii1[A]
Ai1[A] --> Aii2[A]

%% L2-11 %%
Aii1[A] --> Niii1[N]
Niii1 --> 0iiii1[0]

%% L2-12 %%
Aii2[A] --> Niii2[N]
Niii2 --> 0iiii2[1]
end

subgraph R
%% L1-2 %%
Ai2[A] --> Nsi2[N]
Nsi2 --> 0sii2[0]
end
```
Right Tree
```mermaid
graph TD

%% L1 %%
Aroot[A] --> Ai1[A]
Aroot[A] --> Ai2[A]

subgraph R
%% L1-2 %%
Ai2[A] --> Asi1[A]
Ai2[A] --> Asi2[A]

%% L2-21 %%
Asi1[A] --> Nsii1[N]
Nsii1 --> 0siii1[0]

%% L2-22 %%
Asi2[A] --> Nsii2[N]
Nsii2 --> 0siii2[1]
end

subgraph L
%% L1-1 %%
Ai1[A] --> Nii1[N]
Nii1 --> 0iii1[0]
end
```
#### iv.
Left Tree
```mermaid
graph TD

%% L1 %%
Aroot[A] --> Ai1[A]
Aroot[A] --> Ai2[A]

%% L1-1 %%
subgraph L
Ai1[A] --> Aii1[A]
Ai1[A] --> Aii2[A]

%% L2-11 %%
Aii1[A] --> Niii1[N]
Niii1 --> 0iiii1[0]

%% L2-12 %%
Aii2[A] --> Niii2[N]
Niii2 --> 0iiii2[1]
end

subgraph R
%% L1-2 %%
Ai2[A] --> ϵsii2[ϵ]
end
```
Right Tree
```mermaid
graph TD

%% L1 %%
Aroot[A] --> Ai1[A]
Aroot[A] --> Ai2[A]

subgraph R
%% L1-2 %%
Ai2[A] --> Asi1[A]
Ai2[A] --> Asi2[A]

%% L2-21 %%
Asi1[A] --> Nsii1[N]
Nsii1 --> 0siii1[0]

%% L2-22 %%
Asi2[A] --> Nsii2[N]
Nsii2 --> 0siii2[1]
end

subgraph L
%% L1-1 %%
Ai1[A] --> ϵiii1[ϵ]
end
```


## Q2
### a.
```haskell
A -> A A | "(" A ")" | ϵ
```
##### Language
All strings are of the form
$$
L=\{\; w \mid w \in \{(,)\}^* \text{ and } w \text{ is balanced} \;\}  
$$
##### Equivalent Regex
```regex
^(?:\((?R)*\))*$
```
### b.
Left Tree
```mermaid
graph TD

%% Level 1 %%
Eroot[E] --> Ei1[E]
Eroot --> Ei2[E]

%% L1-1 %%
subgraph L
Ei1[E] --> Eii1[E]
Ei1[E] --> Eii2[E]
end
```

Right Tree
```mermaid
graph TD

%% Level 1 %%
Eroot[E] --> Ei1[E]
Eroot --> Ei2[E]

%% L1-2 %%
subgraph R
Ei2[E] --> Esi1[E]
Ei2[E] --> Esi2[E]
end
```

## Q3
### a.
```mermaid
graph TD

Eroot[E] --> Ei1[E]
Eroot --> Ei2['+']
Eroot --> Ei3[T]

%% L1 - 1 %%
Ei1 --> Eii1[E]
Ei1 --> Eii2['+']
Ei1 --> Eii3[T]

%% L2 - 1 %%
Eii1[T] --> Eiii1[F]
Eiii1 --> Eiiii1[3]

%% L2 - 3 %%
Eii3 --> Eiit3[F]
Eiit3 --> Eiiit3[4]

%% L1 - 3 %%
Ei3[T] --> Esi3[F]
Esi3 --> Esii3[5]
```
### b.
```mermaid
graph TD

Eroot[E] --> Ei1[E]
Eroot --> Ei2['-']
Eroot --> Ei3[T]

%% L1 - 1 %%
Ei1 --> Eii1[E]
Ei1 --> Eii2['+']
Ei1 --> Eii3[T]

%% L2 - 1 %%
Eii1[T] --> Eiii1[F]
Eiii1[T] --> Eiiii1[3]

%% L2 - 3 %%
Eii3 --> Eiit1[T]
Eiit1 --> Eiiit1[F]
Eiiit1 --> Eiiiiit1[4]
Eii3 --> Eiit2['*']
Eii3 --> Eiit3[F]
Eiit3 --> Eiiit3[5]

%% L1 - 3 %%
Ei3[T] --> Esi3[F]
Esi3 --> Esii3[6]
```
### c.
```mermaid
graph TD

Eroot[E] --> Eroot1[T]

Eroot1 --> Ei1[E]
Eroot1 --> Ei2['*']
Eroot1 --> Ei3[T]

%% L1 - 1 %%
Ei1 --> Eii1[F]
Eii1 --> Eiii1[3]

%% L1 - 3 %%
Ei3 --> Eit1[E]
Ei3 --> Eit2['*']
Ei3 --> Eit3[T]
```
### d.


### Q4

## Notes
`*` means Kleene star which is zero or more repetition
`+` means Kleene plus which is one or more repetition

