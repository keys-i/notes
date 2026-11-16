#import "template.typ": sheet, topic, rule

#show: body => sheet(
  body,
  column-count: 2,
  text-size: 9.4pt,
  paragraph-leading: 0.72em,
  bottom-margin: 5mm,
  numbering: "1 / 1",
)

#topic("What the 2019-2025 papers actually repeat")[#rule("Every year", [B+ tree operations; transaction schedules/concurrency; recovery])

#rule("Six of seven", [index/storage questions; query-plan or operator optimisation])

#rule("Four or more", [relational algebra; disk arithmetic; views/constraints])

#rule("2023-2025", [the same basic timestamp-ordering trace])]

#topic("Disk and block arithmetic - 2019, 2023-2025")[$C_("track")=n_b B$, $s=2p$ surfaces, $C_("cyl")=s C_("track")$

$C_("disk")=n_t C_("cyl")$, where $n_t$ is tracks/surface

$t_("rev")=60 000/"rpm"$ ms; $t_("rot,avg")=t_("rev")/2$

$r_("transfer")=C_("track")/t_("rev")$ bytes/ms

$t_("block")=B/r_("transfer")=t_("rev")/n_b$

$T_("random")(k) approx k(t_("seek")+t_("rot,avg")+t_("block"))$

$T_("seq")(k) approx t_("seek")+t_("rot,avg")+k t_("block")$

Fixed unspanned records: $"bfr"=floor(B/R)$, $b=ceil(r/"bfr")$]

#topic("Index type and storage - 2019-2022, 2025")[Ordered key $arrow$ sparse primary; ordered non-key $arrow$ clustering; other attribute $arrow$ dense secondary

$E=K+P$ bytes/entry, $f=floor(B/E)$ entries/block, $b_I=ceil(n_I/f)$

#rule("Clustering", [$n_I=V(A,R)$, one entry per distinct ordered value])

#rule("Dense secondary", [$n_I=r$, one entry per record])

#rule("Bitmap", [one $r$-bit vector per value; combine predicates using bitwise AND/OR/NOT])

Fixed bitmap records:
$b_("bitmap")=sum_A V(A,R) ceil((K_A+ceil(r/8))/B)$]

#topic("B+ tree sizing and I/O - 2020-2022")[$p_("max")=floor((B+K)/(P+K))$ internal pointers

$f=floor(u p_("max"))$ at average fill $u$

$l_("max")=floor((B-P_("next"))/(K+P_R))$ leaf entries

$L=ceil(r/(u l_("max")))$ leaves; repeatedly $ceil(L/f)$ until one root remains

Tree height is the number of node levels, including root and leaves

Equality I/O = root-to-leaf height + data I/O

Unclustered non-key worst case: one data I/O per match; clustered: matching data blocks]

#topic("B+ tree drawing recipe - every year")[(1) Search to the target leaf and keep leaf keys sorted

(2) On leaf overflow, split as specified and copy the first key of the new right leaf into the parent

(3) On internal overflow, split children and promote the separator; grow a new root if needed

(4) On delete, stop if minimum occupancy remains; otherwise borrow from a same-parent sibling and update the separator

(5) If borrowing fails, merge, remove the parent separator and repair upward; collapse a one-child root

#rule("Range query", [descend once to the first possible leaf, then follow leaf links until the upper bound is passed; list every node read])]

#topic("Selectivity and access choice - 2021-2022")[$"sel"(c)=abs(sigma_c(R))/abs(R)$; estimated rows $=r "sel"(c)$

Key equality: $1/r$; uniform equality: $1/V(A,R)$; histogram range: add supplied fractions

Linear scan: $b_R$ I/O

Ordered binary search: $ceil(log_2 b_R)$ + result blocks

Clustered B+ tree: $h+b_("match")$

Unclustered B+ tree: $h+n_("match")$ in the one-record-per-block worst case

Binary search is unavailable on an unordered file; calculate every applicable cost and choose the minimum]

#topic("Nested-loop join cost - 2019-2022")[$C_("tuple")=b_O+n_O b_I$

Page-oriented: $C_("page")=b_O+b_O b_I$

With $M$ memory blocks:
$C_("block")=b_O+ceil(b_O/(M-2))b_I$

Calculate both orientations. Tuple loops favour fewer outer tuples; block loops usually favour fewer outer blocks]

#topic("Relational algebra patterns - 2019, 2021, 2023-2025")[#rule("None", [candidate keys minus forbidden keys, then join back for requested names])

$"NONE"=pi_K(R)-pi_K(R bowtie S)$

#rule("Every", [$R(X,Y) div S(Y)$ returns each $X$ paired with every $Y$ in $S$])

$R div S=pi_X(R)-pi_X((pi_X(R) times S)-R)$

#rule("Result-size bounds", [$abs(R bowtie S):0..N_1N_2$; $abs(pi_A(R)):1..N_1$ for non-empty $R$; $abs(R_1 union R_2):max(N_1,N_2)..N_1+N_2$])

Rename self-joins; keep join attributes until after the join]

#topic("Five-step QEP rewrite - 2019-2022, 2024-2025")[(1) Split conjunctive selections into separate $sigma$

(2) Push each selection to its own base relation

(3) Replace $times$ plus its join predicate with $bowtie$

(4) Execute the most restrictive selection/join first

(5) Push projections down, retaining output and future join attributes

Label the rule at each step and draw the final tree; a unique-value selection is usually the most restrictive]

#topic("Views and cross-row constraints - 2020-2021, 2023, 2025")[A simple single-table view is updateable when each view row maps to one base row; including the primary key preserves identity

A materialised view stores results: faster reads, extra storage and refresh/staleness cost

Static constraint limits a valid state; dynamic constraint limits a state transition

Use key / `CHECK` / FK for one-row rules. Exam assertion pattern for totals/counts:

```sql
CREATE ASSERTION a CHECK (NOT EXISTS (
  SELECT group_key FROM detail
  GROUP BY group_key HAVING invalid_total
));
```

Join the parent table inside the subquery when the limit, such as Budget or Capacity, lives there]

#topic("Schedule triage - 2019-2025")[#rule("Dirty read", [$T_j$ reads a value written but not committed by $T_i$])

#rule("Dirty write", [$T_j$ overwrites uncommitted $T_i$; aborting $T_i$ may erase $T_j$])

#rule("Lost update", [both read an old value; the later write overwrites the first update])

Preserve each transaction's program order when repairing a schedule

If $T_j$ reads from $T_i$: recoverable requires $c_i<c_j$; cascadeless requires $c_i<r_j(X)$; strict blocks any read/write of $X$ until $T_i$ ends]

#topic("Conflict serialisability - 2019-2025")[Two operations conflict only when they are in different transactions, access the same item and at least one is a write

(1) Create one node per transaction

(2) Scan the schedule left-to-right

(3) Add $T_i arrow T_j$ when $T_i$'s conflicting operation occurs first

Acyclic graph $arrow.l.r$ conflict-serialisable; any topological order is an equivalent serial order. A cycle proves it is not conflict-serialisable]

#topic("2PL protocols and lock insertion - 2019-2024")[(S,S) is compatible; any pair containing X is incompatible

#rule("Basic 2PL", [growing phase acquires locks; after the first unlock, acquire no new lock])

#rule("Conservative 2PL", [obtain every required lock before starting; deadlock-free])

#rule("Strict 2PL", [hold X locks until commit/abort; prevents dirty reads/writes and cascading rollback])

For read-then-write, request X before the read or upgrade S to X during the growing phase. Under strict 2PL, place unlocks after commit/abort

Basic and strict 2PL can deadlock]

#topic("Wait-for graph and starvation - 2021, 2023-2024")[For each incompatible blocked request by $T_i$, add $T_i arrow T_j$ to every transaction $T_j$ holding the required lock

A directed cycle means live deadlock. Choose a victim using work done, rollback cost, locks held, priority and previous restarts

Timeout is simple but can abort a merely slow transaction; a long timeout detects real deadlocks slowly

Starvation means repeated victimisation or indefinite postponement; prevent it with ageing or a restart limit]

#topic("Basic timestamp trace - repeated 2023-2025")[$"TS"(T)$ is fixed; each item stores $"RT"(X), "WT"(X)$

#rule("read(X)", [abort if $"TS"(T)<"WT"(X)$; else set $"RT"(X)=max("RT"(X),"TS"(T))$])

#rule("write(X)", [abort if $"TS"(T)<"RT"(X)$ or $"TS"(T)<"WT"(X)$; else write and set $"WT"(X)="TS"(T)$])

Copy the full item state after every row. Local calculations change no database timestamp. On abort, undo that transaction's earlier writes, ignore its remaining operations and restart with a fresh timestamp only if asked]

#topic("The repeated timestamp outcome - 2023-2025")[The oldest transaction writes $X$; the middle transaction writes $Z$; the youngest writes $Y$

At the final old-transaction `write(Z)`, both $"RT"(Z)$ and $"WT"(Z)$ equal the middle timestamp, which is newer

Therefore the final write is rejected, the oldest transaction aborts and its earlier write to $X$ is restored. This is the same trace with renamed transactions/items in all three papers]

#topic("WAL and the recovery matrix - every year")[WAL: force the update log record before its data page; force the commit log record before reporting commit

#rule("Steal", [uncommitted pages may reach disk $arrow$ UNDO])

#rule("No-force", [committed pages may remain in memory $arrow$ REDO])

#table(
  columns: 3,
  align: (left, center, center),
  stroke: 0.35pt + rgb("#b7c0f4"),
  inset: (x: 4pt, y: 2pt),
  [*Policy*], [*UNDO*], [*REDO*],
  [steal / no-force], [yes], [yes],
  [steal / force], [yes], [no],
  [no-steal / no-force], [no], [yes],
  [no-steal / force], [no], [no],
)]

#topic("Checkpoint timeline questions - 2019-2025")[(1) Mark checkpoint and crash on a time axis

(2) Classify each transaction: committed before checkpoint, committed after it, active at crash or already aborted

(3) Apply the stated buffer policy rather than guessing from the picture

Under the exam's flushed-checkpoint model: committed before checkpoint needs nothing; committed after checkpoint is REDO only when policy is no-force; active-at-crash is UNDO only when policy is steal; already-aborted needs nothing

UNDO losers backwards; REDO winners forwards]

#topic("The repeated recovery log - 2024-2025")[The supplied log has: $T_7$ committed before checkpoint; $T_8$ and $T_5$ committed after it; $T_6$ and $T_9$ active at crash

#rule("Deferred / no-steal, no-force", [$T_7$: none; REDO $T_8,T_5$; no disk UNDO for $T_6,T_9$])

#rule("Immediate / steal, no-force", [$T_7$: none; REDO $T_8,T_5$; UNDO $T_6,T_9$])

#rule("Immediate / steal, force", [UNDO $T_6,T_9$; no REDO])]

#topic("ACID answers that earn the definition marks")[#rule("Atomicity", [all operations happen or none do - WAL and UNDO])

#rule("Consistency", [each committed transaction preserves declared invariants - constraints and correct transaction logic])

#rule("Isolation", [concurrent result is equivalent to an allowed serial execution - locking/timestamps])

#rule("Durability", [committed effects survive later failure - WAL and REDO])]
