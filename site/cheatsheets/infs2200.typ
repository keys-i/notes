#import "template.typ": sheet, topic, rule

#show: body => sheet(
  "INFS2200",
  "Relational Database Systems",
  "Cross-checked against accessible 2021–2024 papers and current course notes · diagrams and image-only equations still need the source paper",
  body,
)

#topic("Disk geometry & capacity")[(Use consistent byte units)

$s = 2p$ surfaces for $p$ double-sided platters

$C_("track") = n_b B$

$C_("cyl") = s C_("track")$

$C_("disk") = n_t C_("cyl")$

Here $n_b$ is blocks/track, $B$ block bytes and $n_t$ tracks/surface]

#topic("Disk timing")[$t_("rev") = 60 000 / "rpm"$ ms

$t_("rot,avg") = t_("rev")/2$

$r_("transfer") = C_("track")/t_("rev")$ bytes/ms

$t_("block") = B/r_("transfer") = t_("rev")/n_b$

$t_("access") = t_("seek")+t_("rot")+t_("transfer")$

$T_("random")(k) approx k(t_("seek")+t_("rot,avg")+t_("block"))$

$T_("seq")(k) approx t_("seek")+t_("rot,avg")+k t_("block")$]

#topic("Records & blocks")[$"bfr" = floor(B/R)$ records/block for fixed unspanned rows

$b = ceil(r/"bfr")$ blocks

Spanned lower bound: $b = ceil(r R/B)$

$R$ is record bytes and $r$ is record count]

#topic("Index storage")[$E = K + P$ bytes/index entry

$f = floor(B/E)$ entries/block

$b_I = ceil(n_I/f)$ index blocks

#rule("Clustering index", [$n_I = V(A,R)$ for one entry per ordered value])

#rule("Dense secondary", [$n_I = r$ when every record has an entry])

#rule("Bitmap", [one vector/value uses $ceil(r/8)$ bytes])

Fixed bitmap records:
$b_("bitmap")=sum_A V(A,R) ceil((K_A+ceil(r/8))/B)$]

#topic("B+ tree sizing")[$p_("max")=floor((B+K)/(P+K))$ internal pointers

$f approx floor(u p_("max"))$ at fill ratio $u$

$l_("max")=floor((B-P_("next"))/(K+P_R))$ leaf entries

$L=ceil(r/(u l_("max")))$ leaf nodes

$h approx 1+ceil(log_f L)$ levels (check whether the root already covers all leaves)

Point I/O $approx h$ plus data access; ranges then follow linked leaves]

#topic("Selectivity & cardinality")[$"sel"(c)=abs(sigma_c(R))/abs(R)$

$abs(sigma_c(R)) approx abs(R) "sel"(c)$

Uniform equality: $"sel"(A=v) approx 1/V(A,R)$

Key equality: $"sel" approx 1/abs(R)$

Independent AND: $"sel"(c_1 and c_2) approx "sel"(c_1) "sel"(c_2)$

Disjoint OR: $"sel"(c_1 or c_2) approx "sel"(c_1)+"sel"(c_2)$]

#topic("Selection I/O cost")[$C_("scan")=b_R$

Ordered binary search $approx ceil(log_2 b_R)$, then add result blocks

Clustered B+ tree $approx h+b_("match")$

Unclustered B+ tree $approx h+n_("match")$ in the pessimistic one-record-per-block case

Choose the lowest cost using the assumptions given in the question]

#topic("Nested-loop joins")[$C_("tuple")=b_O+n_O b_I$

With $M$ memory blocks:
$C_("block")=b_O+ceil(b_O/(M-2))b_I$

One outer block at a time: $b_O+b_O b_I$

Test both orientations; the smaller tuple count helps tuple loops, while the smaller block count usually helps block loops]

#topic("Relational algebra")[$sigma_c(R)$ rows · $pi_A(R)$ columns · $rho(R)$ rename

$R bowtie_c S = sigma_c(R times S)$

$R div S$ returns values related to every tuple in $S$

For “none”: build the forbidden set, then subtract it from the candidate set

Keep join attributes until after the join]

#topic("Query-tree rewrite")[(1) split conjunctive selections

(2) push selections down

(3) replace $times$ + join condition with $bowtie$

(4) perform the most restrictive join first

(5) push projections down while retaining join/output fields

Then compare physical access costs; fewer logical operators does not imply less I/O]

#topic("Dependencies & normal forms")[$X^+$: start with $X$, repeatedly add RHS attributes whose LHS is contained in the closure

$X$ is a superkey iff $X^+$ contains every relation attribute

#rule("3NF", [for every non-trivial $X arrow A$, $X$ is a superkey or $A$ is prime])

#rule("BCNF", [for every non-trivial $X arrow A$, $X$ is a superkey])]

#topic("Schedule tests")[(1) preserve each transaction's operation order

(2) conflict only across transactions, on the same item, with at least one write

(3) add precedence edge $T_i arrow T_j$ when $T_i$'s conflicting operation occurs first

Acyclic graph $arrow.l.r$ conflict-serialisable; a topological order is the serial order

If $T_j$ reads from $T_i$: recoverable requires $c_i < c_j$; cascadeless requires $c_i < r_j(X)$; strict blocks reads/writes of $X$ until $T_i$ ends]

#topic("Locks & deadlock")[(S,S) compatible; any pair containing X is blocked

#rule("2PL", [acquire during growing phase; after first release, acquire no more locks])

Wait-for edge $T_i arrow T_j$ means $T_i$ waits for $T_j$; a cycle means deadlock

Basic 2PL gives conflict serialisability, not deadlock freedom; conservative 2PL avoids deadlock]

#topic("Timestamp ordering")[$"TS"(T)$ is transaction time; each item stores $"RT"(X), "WT"(X)$

#rule("read(X)", [abort if $"TS"(T)<"WT"(X)$; else $"RT"(X)=max("RT"(X),"TS"(T))$])

#rule("write(X)", [abort if $"TS"(T)<"RT"(X)$ or $"TS"(T)<"WT"(X)$; else write and set $"WT"(X)="TS"(T)$])

Transactions never wait, so deadlock is avoided; restarts may starve]

#topic("Recovery")[(WAL) write the update log before its data page; force the commit log before reporting success

#rule("Steal", [uncommitted pages may reach disk $arrow$ UNDO])

#rule("No-force", [committed pages may remain in memory $arrow$ REDO])

steal/no-force: UNDO + REDO · steal/force: UNDO · no-steal/no-force: REDO · no-steal/force: neither

After crash: find checkpoint, classify winners/losers, UNDO losers backwards, REDO winners forwards]

#topic("Fast exam checks")[- Floor for records per block; ceiling for blocks/nodes
- Keep records, blocks, bytes and I/O distinct
- State uniformity, clustering, fill ratio and buffer assumptions
- Precedence graph tests serialisability; wait-for graph tests live deadlock
- Selectivity is a fraction; cardinality is a count
- `CHECK` handles one-row invariants; multi-row totals need a transaction-safe trigger]
