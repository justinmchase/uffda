# Direct left recursion

This chapter defines the pattern-level contract for expressing and composing
direct left recursion in Uffda grammars.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../patterns.spec.md#conventions).

## Logical purpose

Direct left recursion allows grammar authors to describe naturally
left-associative structures without manually rewriting those rules into
non-left-recursive forms.

## Definitions

- Direct left recursion (DLR) occurs when a rule can invoke itself again at the
  same input position through its first recursive expansion.
- A base case is a non-left-recursive alternative or path that permits the rule
  to establish an initial successful seed.
- A growth step is a later successful evaluation that extends a previously
  seeded direct-left-recursive result at the same input position.

## Pattern-level model

- Direct left recursion MUST be treated as a supported pattern-authoring form.
- A directly left-recursive rule SHOULD pair one or more recursive branches with
  at least one non-left-recursive base case.
- A directly left-recursive rule SHOULD express the recursive branch in the
  earliest viable alternative position when using ordered choice.
- Direct left recursion SHOULD be used primarily for left-associative grammar
  structures such as binary operator chains.

## Behavioral expectations

- Pattern evaluation MUST recognize direct left recursion as distinct from
  ordinary failure.
- When a directly left-recursive path is encountered, evaluation MUST route
  through the runtime mechanism defined in
  [runtime left recursion](../runtime/left-recursion.spec.md).
- A pattern that delegates into a directly left-recursive rule MUST NOT
  reinterpret the left-recursion outcome as ordinary success or failure unless
  its own chapter explicitly defines behavior that remains consistent with the
  runtime chapter.
- A directly left-recursive rule MUST stabilize only through progress-producing
  growth, as defined by the runtime chapter.

## Ordered choice and sequencing interactions

- Ordered choice is the primary composition form used to express direct left
  recursion.
- When ordered choice is used for direct left recursion, recursive branches
  SHOULD appear before non-recursive fallback branches that establish the base
  case.
- Sequencing within a directly left-recursive branch SHOULD place the
  self-reference in the leading position that creates the left-associative
  structure.
- Pattern authors MAY use additional composed patterns around a directly
  left-recursive branch as long as those patterns preserve the distinction
  between left-recursion outcomes and ordinary match outcomes.

## Scope and input-position invariants

- Direct left recursion MUST be evaluated relative to a fixed caller-visible
  input position during seeding and growth.
- Growth attempts that do not extend the recognized input MUST terminate
  according to the runtime left-recursion contract.
- Scope-visible bindings and outputs from unsuccessful exploratory growth MUST
  NOT leak past the final stabilized result.
- Direct left recursion MUST remain consistent with
  [runtime scopes](../runtime/scopes.spec.md) and
  [pattern matching](./pattern-matching.spec.md).

## Supported and unsupported forms

- Direct left recursion MUST be supported.
- This chapter does not extend support to indirect left recursion as a general
  pattern-authoring capability.
- Grammars that rely on indirect left recursion MUST follow the rejection or
  error behavior defined in
  [runtime left recursion](../runtime/left-recursion.spec.md#supported-and-unsupported-forms).

## Composition intent

- Grammar authors SHOULD prefer direct left recursion over manual grammar
  rewriting when expressing left-associative constructs.
- Grammar authors MAY refactor recursive structures into direct left-recursive
  form to stay within the supported recursion model.
- Runtime pattern chapters that commonly participate in directly left-recursive
  structures, especially ordered choice and reference-like delegation, SHOULD
  refine this chapter where they impose stricter local rules.
