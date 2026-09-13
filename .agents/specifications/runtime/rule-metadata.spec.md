# Runtime rule metadata

This chapter defines the runtime contract for decorator invocation and the
metadata it attaches to `rule`/`func` declarations.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

Rule metadata lets tooling (for example a semantic-highlighting LSP, see
[#155](https://github.com/justinmchase/uffda/issues/155)) and the runtime itself
query declarative, author-attached annotations on a rule or func — for example
"this rule produces a token span" — without a parallel, hand-maintained
classification layer that can drift from the grammar. See
[#159](https://github.com/justinmchase/uffda/issues/159) and the syntax layer in
[decorator declarations](../languages/uffda-syntax/decorator-declarations.spec.md).

## Definitions

- A **decorator** is a `func` referenced by a `[Name arg…]` group written
  immediately before a `rule` or `func` declaration.
- **Decorator invocation** is the act of evaluating a decorator's body once, at
  declaration-processing time, with the author-supplied arguments.
- **Presence** is the fact that a given decorator func was applied to a given
  declaration, independent of what (if anything) it returned.
- **Rule metadata** is the merged object built from every decorator's return
  value on one declaration.

## Boundary (non-goal for this chapter)

- Decorator invocation MUST NOT alter the pattern or expression semantics of the
  declaration it decorates. A decorator contributes data only; it MUST NOT
  replace, wrap, or transform matching behavior.
- A future, separate mechanism MAY define declaration-rewriting decorators (for
  example, an optimizer that substitutes a rule's pattern). That is explicitly
  out of scope here and MUST NOT be conflated with this chapter's metadata-only
  contract.

## Constraints

### Invocation constraints

- Decorator invocation MUST use the same evaluation model as ordinary
  `ExpressionLang` invocation (see
  [function invocation](../languages/expression-syntax/function-invocation.spec.md)):
  arguments MUST be evaluated left to right, and invocation MUST remain free of
  observable side effects, consistent with the general func-declaration contract
  (author-defined funcs are not special-cased for decorator use).
- Within a decorator's body, the reserved name `this` MUST resolve to the `Rule`
  or `Func` declaration being decorated, not to a `MatchOk`. This extends,
  rather than conflicts with, the existing `this` contract in
  [reference expressions](../expressions/reference.spec.md): `this` always
  resolves to "the value this evaluation is about," and decorator invocation is
  a distinct evaluation phase from match-time expression evaluation.
- `this` in decorator-invocation context MUST expose only the pre-decoration
  structural fields of the declaration (`name`, `module`, `pattern`,
  `parameters`, `expression`). It MUST NOT expose `metadata` or `decorators`,
  including any metadata already merged by earlier decorators in the same list.
  This keeps decorator invocation acyclic by construction: a decorator can never
  observe its own or a sibling decorator's not-yet-final output, which covers
  cases such as a decorator naming itself (`[Example] func Example = …`) or one
  decorator attempting to read another's result via `this`.
- A decorator with no declared parameters MUST still be invocable with zero
  arguments (`[Name]`), consistent with func declarations' own zero-argument
  normalization.

### Presence and metadata constraints

- Applying a decorator to a declaration MUST unconditionally record that
  decorator's identity against the declaration, regardless of what its
  invocation returns (including `null`/no meaningful value). This supports a
  decorator used purely as a marker (an "observer"), with no computed value.
- If a decorator invocation's result is an object, that object's keys MUST be
  shallow-merged onto the declaration's metadata.
- When multiple decorators contribute the same metadata key, the later-applied
  decorator (in written, left-to-right order) MUST win — metadata merge is not
  required to detect or reject cross-decorator key collisions.
- Applying the same resolved decorator func more than once to a single
  declaration MUST fail declaration resolution. This check is by decorator
  _identity_ (the resolved func), not by the keys its result would produce.
- Decorator order MUST be preserved and MUST determine both invocation order and
  merge order.

## Mechanism

- Decorator resolution and invocation happen once, during declaration
  processing, after the decorated declaration's own `pattern`/`parameters`/
  `expression` are otherwise fully formed — mirroring when a module's other
  declarations become available for reference.
- For each decorator in written order: resolve `Name` to a `Func`; evaluate it
  with the written arguments and `this` bound to the declaration; append
  `{ func, args }` to the declaration's ordered decorator list (presence);
  shallow-merge an object result onto the declaration's metadata.
- `Rule` (and `Func`) gain an optional `decorators` (ordered `{ func, args }`
  list) and an optional `metadata` (merged object) field.
- Rule metadata does not require a new field on `Match`: it is reachable through
  the existing `MatchOrigin.rule` link (see `src/match.ts`), which is already
  preserved across memoized cache hits, not only first computation.

## Why this design

- **Func-based, not bare literal tags.** A decorator's whole value is that it is
  a named, reusable, importable/exportable declaration — define
  `Token`/`Identifier`/`QuotedString` once (potentially in a shared module) and
  apply the name everywhere, the same reason rules and funcs are named
  declarations rather than inline literals.
- **Presence recorded unconditionally.** Without this, a purely observational
  decorator (an identity func with no meaningful return value) would be
  indistinguishable from "not applied," defeating its use as a marker.
- **Merge, not replace, for metadata.** Independently authored decorators should
  be able to compose without each needing to know the others' full key sets, as
  long as they do not collide; later-wins keeps merge order well-defined without
  requiring global coordination between decorator authors.
- **Duplicate-application rejected by identity.** Silently allowing
  `[Token][Token]` would make written decorator lists misleading; rejecting it
  is a cheap, unambiguous check once `Name` is resolved.
- **`this` reused, not a new keyword.** `this` already means "the value this
  evaluation is about" (see `reference.spec.md`); rebinding it per evaluation
  phase is consistent with that meaning rather than introducing a second
  reserved word for the same concept.
- **`this` excludes in-progress metadata.** Restricting `this` to pre-decoration
  structural fields makes decorator invocation acyclic without a separate cycle
  check: a func decorating itself (`[Example] func Example = …`), or a decorator
  that references `this.metadata`, can never observe output that does not yet
  exist, so no runaway or nondeterministic-ordering hazard can arise from self-
  or sibling-reference through `this`.
- **Metadata-only boundary.** Keeping decorators unable to change matching
  behavior means a rule's observable results never depend on which decorators
  were applied, which keeps this chapter's correctness reasoning simple:
  metadata can be added, removed, or reordered without ever changing what a
  grammar accepts. A rewriting mechanism, if pursued later, needs its own
  chapter and its own correctness argument.

## Failure surface

- An unresolvable decorator name MUST fail the same way any unresolved reference
  fails.
- A duplicate decorator application (same resolved func on one declaration) MUST
  fail declaration resolution deterministically.
- A decorator whose invocation raises an expression exception MUST fail
  declaration resolution with that exception, not silently skip the decorator.
- A decorator naming the very declaration it decorates (for example
  `[Example] func Example = …`) MUST NOT be specially rejected: it resolves and
  invokes exactly like any other decorator reference, and the `this`-exposure
  constraint above already prevents it from being a correctness hazard.
