# Runtime memory management

This chapter defines the lifetime guarantees for dynamically allocated runtime
values, captured environments, and retained execution results.

## Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are interpreted as
described in RFC 2119 and RFC 8174 when they appear in all capitals.

## Definitions

- A root is a runtime-owned or externally retained reference that keeps a value
  graph alive.
- A live value is reachable from a root through runtime references.
- A collection boundary is a point where execution allows reclamation.

## Axioms

- Collection MUST NOT change observable value contents or identity.
- Collection MUST NOT invalidate live values, captured lexical bindings, or
  retained results.
- Unreachable cycles MUST NOT require callers to manually break references.

## Constraints

### Value identity

- Null and undefined MUST remain distinct values.
- Number equality MUST preserve the current strict-equality behavior for NaN and
  signed zero.
- Strings MUST compare by contents.
- Arrays and objects MUST compare by reference identity for strict equality;
  equal contents alone MUST NOT imply equal identity.

### Roots and captures

- Active execution, suspended execution, retained matches, memoized results, and
  cached modules MUST keep every value they can subsequently observe alive.
- A captured environment MUST keep its bindings and lexical ancestors alive.
- Lexical lookup MUST select the nearest binding; an explicit undefined binding
  MUST NOT be confused with a missing binding.
- Roots MUST be isolated between runtime instances.
- Releasing the last root MUST permit reclamation of the graph, including cyclic
  references, at a subsequent completed collection.

## Mechanism

Implementations MAY use a host collector or a tracing collector. Collection
boundaries MUST retain execution state before temporarily relinquishing access
to that state, including when yielding for asynchronous work. Storage and
rooting tests alone do not establish correctness of suspension or evaluation.
Rust pending execution is rooted continuation state, not a language Promise
value. Host asynchronous work MUST run outside collector mutation/borrow scopes;
resumption MUST re-enter the collector safely before installing values.

Failure or abandonment MUST release temporary evaluation state. Deeply nested
pending syntax MUST NOT overflow the host stack during that cleanup.

## Why this design

Reference counting alone cannot reclaim cycles involving captured environments
and callable values. Treating an entire runtime's allocations as permanently
live also does not satisfy long-lived parsing and evaluation. Explicit lifetime
guarantees allow collection without changing language behavior.
