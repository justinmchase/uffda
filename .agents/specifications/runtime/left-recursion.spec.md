# Runtime left recursion

This chapter defines the runtime contract for direct and indirect left recursion
in Uffda pattern matching.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

Runtime left-recursion handling allows natural left-associative grammar
definitions without requiring grammar authors to manually rewrite rules into
non-left-recursive forms.

## Definitions

- Direct left recursion (DLR) occurs when a rule can invoke itself at the same
  input position through the first recursive expansion of that same rule.
- Indirect left recursion (ILR) occurs when recursion returns to a rule through
  one or more different rules at the same input position.

## Supported and unsupported forms

- The runtime MUST support direct left recursion.
- The runtime MUST use memoized seed-and-grow style evaluation for direct
  left-recursive rule growth at a fixed input position.
- The runtime MUST require progress when growing direct left-recursive matches;
  non-progressing growth MUST terminate.
- The runtime MUST NOT claim support for indirect left recursion as a general
  capability.
- If indirect left recursion is detected during rule evaluation, runtime
  behavior MUST reject it by fail or error according to the active evaluation
  path.

## Pattern-matching interactions

- Patterns that delegate to child patterns (for example, alternation and
  references) MUST propagate left-recursion outcomes unchanged unless their
  chapter defines stricter behavior.
- Alternation (`or`) SHOULD place direct-left-recursive branches before
  non-recursive fallback branches when expressing left-associative constructs.
- The left-recursion handling contract used by `or` MUST follow this runtime
  chapter.

## Why this design

- Supporting DLR provides a more ergonomic authoring model for users writing
  expression grammars with left-associative operators.
- Supporting DLR preserves expected result-tree shape for left-associative
  constructs without requiring an extra grammar-level shift/restructuring step.
- Rejecting general ILR avoids ambiguous or non-terminating recursion behavior
  that is harder to reason about in this runtime model.

## Research context

- This design follows the research direction associated with Alessandro Warth's
  work on OMeta and left-recursive PEG/packrat parsing.
- Relevant OMeta materials are cataloged by Alessandro Warth at
  https://tinlizzie.org/ometa/.
- Ohm (a project co-created by Alessandro Warth) documents full left-recursion
  support in its public documentation at https://ohmjs.org/.
- The runtime strategy is aligned with seed-and-grow style ideas from Warth's
  left-recursion packrat research and subsequent OMeta/Ohm practice.

## Error conditions

- Runtime detection of unsupported indirect left recursion MUST surface a
  defined recursion error or equivalent rejection outcome.

## Side effects

- Left-recursion handling MUST NOT produce externally observable side effects
  beyond match outcomes, memoization state, and defined diagnostics.

## Composition intent

- Grammar authors SHOULD model left-associative operators using direct
  left-recursive structures when possible.
- Grammar authors MAY refactor ILR-prone structures into DLR-friendly shapes
  when runtime rejection of ILR is encountered.
