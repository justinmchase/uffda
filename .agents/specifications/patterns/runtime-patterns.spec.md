# Runtime patterns

This chapter indexes the runtime pattern subtopics.

## Implementation migration plan

The following patterns specified in this chapter will replace or supersede
existing patterns currently in the codebase during implementation:

- `resolve` (new pattern) will replace and unify the current `reference` and
  `special` patterns
- `quantifier` will replace the current `slice` pattern
- `lookahead` is a new pattern to be implemented

This consolidation simplifies the pattern API and aligns implementation with
the unified semantics defined in the specifications.

## Runtime pattern chapter structure

Each runtime pattern subtopic should define:

- the pattern's logical purpose;
- the pattern's behavioral expectations;
- the pattern's left-recursion behavior, when it delegates to child patterns or
  nested matches;
- the pattern's input consumption behavior;
- the pattern's expected output;
- the pattern's error conditions;
- the pattern's side effects;
- the pattern's compositional intent;
- the pattern's illustrative examples;

## Subtopics

- [and pattern](./runtime/and.spec.md)
- [any pattern](./runtime/any.spec.md)
- [between pattern](./runtime/between.spec.md)
- [character pattern](./runtime/character.spec.md)
- [end pattern](./runtime/end.spec.md)
- [equal pattern](./runtime/equal.spec.md)
- [except pattern](./runtime/except.spec.md)
- [fail pattern](./runtime/fail.spec.md)
- [includes pattern](./runtime/includes.spec.md)
- [into pattern](./runtime/into.spec.md)
- [lookahead pattern](./runtime/lookahead.spec.md)
- [maybe pattern](./runtime/maybe.spec.md)
- [not pattern](./runtime/not.spec.md)
- [ok pattern](./runtime/ok.spec.md)
- [or pattern](./runtime/or.spec.md)
- [over pattern](./runtime/over.spec.md)
- [pipeline pattern](./runtime/pipeline.spec.md)
- [quantifier pattern](./runtime/quantifier.spec.md)
- [regexp pattern](./runtime/regexp.spec.md)
- [resolve pattern](./runtime/resolve.spec.md)
- [run pattern](./runtime/run.spec.md)
- [then pattern](./runtime/then.spec.md)
- [type pattern](./runtime/type.spec.md)
- [variable pattern](./runtime/variable.spec.md)
