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
[#159](https://github.com/justinmchase/uffda/issues/159), the syntax layer in
[decorator declarations](../languages/uffda-syntax/decorator-declarations.spec.md),
and
[declaration attributes](../languages/uffda-syntax/declaration-attributes.spec.md).

## Definitions

- A **decorator** is a `decorator` declaration, materialized at runtime as a
  `DecoratorFunc` — structurally similar to a `Func`, but stored in a namespace
  (`Module.decorators`/`Module.decoratorImports`) entirely separate from
  `Module.funcs`/`Module.imports`.
- An **attribute** is a `[Name arg…]` group written immediately before a `rule`
  or `func` declaration, naming a decorator to apply.
- **Decorator invocation** is the act of evaluating a decorator's body once, at
  declaration-processing time, with the author-supplied arguments.
- **Presence** is the fact that a given decorator was applied to a given
  declaration, independent of what (if anything) it returned.
- **Rule metadata** is the object built from every applied decorator's return
  value on one declaration, keyed by decorator name.

## Boundary (non-goal for this chapter)

- Decorator invocation MUST NOT alter the pattern or expression semantics of the
  declaration it decorates. A decorator contributes data only; it MUST NOT
  replace, wrap, or transform matching behavior.
- A future, separate mechanism MAY define declaration-rewriting decorators (for
  example, an optimizer that substitutes a rule's pattern). That is explicitly
  out of scope here and MUST NOT be conflated with this chapter's metadata-only
  contract.

## Constraints

### Namespace constraints

- A decorator MUST be resolved exclusively against `decorator` declarations
  (`Module.decorators`/`Module.decoratorImports`). It MUST NOT be resolved
  against `rule`, `func`, or ordinary imported names, and vice versa: a
  `decorator` name MUST NOT be resolvable as an ordinary reference or invocation
  target inside a ExpressionLang expression.
- Because a decorator's body is reachable only through the attribute-
  application path defined below, and never through ordinary
  reference/invocation evaluation, `this` inside a decorator's body has exactly
  one meaning (see Invocation constraints) — there is no call site from which it
  could mean anything else, and no runtime or static guard is required to
  enforce this: it follows from the namespaces being disjoint.

### Invocation constraints

- Decorator invocation MUST use the same evaluation model as ordinary
  `ExpressionLang` invocation (see
  [function invocation](../languages/expression-syntax/function-invocation.spec.md)):
  arguments MUST be evaluated left to right, and invocation MUST remain free of
  observable side effects.
- Within a decorator's body, the reserved name `this` MUST resolve to the `Rule`
  or `Func` declaration being decorated. This extends, rather than conflicts
  with, the existing `this` contract in
  [reference expressions](../expressions/reference.spec.md): `this` always
  resolves to "the value this evaluation is about," and decorator invocation is
  a distinct evaluation phase from match-time expression evaluation.
- `this` in decorator-invocation context MUST expose only the pre-decoration
  structural fields of the declaration (`name`, `module`, `pattern`,
  `parameters`, `expression`). It MUST NOT expose `metadata` or `attributes`,
  including any metadata already merged by earlier decorators in the same list.
  This keeps decorator invocation acyclic by construction: a decorator can never
  observe its own or a sibling decorator's not-yet-final output, which covers
  one decorator attempting to read another's result via `this`, regardless of
  which declaration either decorator is applied to.
- A decorator with no declared parameters MUST still be invocable with zero
  arguments (`[Name]`), consistent with func/decorator declarations' own
  zero-argument normalization.

### Presence and metadata constraints

- Applying a decorator to a declaration MUST unconditionally record that
  decorator's identity against the declaration, regardless of what its
  invocation returns (including `null`/no meaningful value). This supports a
  decorator used purely as a marker (an "observer"), with no computed value.
- A decorator's return value MUST be recorded on the declaration's metadata
  keyed by the decorator's name (`metadata[Name] = result`), whatever the
  result's type — object, scalar, `null`, or `undefined`. Metadata is not merged
  across decorators; each decorator owns exactly one key, its own name.
- Applying the same resolved decorator more than once to a single declaration
  MUST fail declaration resolution. This check is by decorator _identity_ (the
  resolved `DecoratorFunc`), not by name text.
- Attribute order MUST be preserved and MUST determine invocation order.

## Mechanism

- Decorator resolution and invocation happen once, during declaration
  processing, after the decorated declaration's own `pattern`/`parameters`/
  `expression` are otherwise fully formed — mirroring when a module's other
  declarations become available for reference.
- For each attribute in written order: resolve `Name` against
  `Module.decorators`/`Module.decoratorImports` to a `DecoratorFunc`; evaluate
  it with the written arguments and `this` bound to the declaration; append
  `{ decorator, args }` to the declaration's ordered attribute list (presence);
  assign the result onto `metadata[Name]`.
- `Rule` (and `Func`) gain an optional `attributes` (ordered
  `{ decorator, args
  }` list) and an optional `metadata` (name-keyed object)
  field.
- Rule metadata does not require a new field on `Match`: it is reachable through
  the existing `MatchOrigin.rule` link (see `src/match.ts`), which is already
  preserved across memoized cache hits, not only first computation.

## Why this design

- **A distinct `decorator` declaration, not a tagged `func`.** An earlier design
  let any ordinary `func` double as a decorator target. That collapsed two
  incompatible calling conventions onto one declaration family: `this` meant a
  match result in ordinary invocation but the decorated `Rule`/`Func` in
  decorator invocation, distinguishable only by call site, with no static or
  dynamic guard. Introducing `decorator` as its own declaration kind, in its own
  namespace, removes the ambiguity by construction: a decorator's body is only
  ever reached through attribute application, so `this` there has exactly one
  meaning, and an ordinary func can never accidentally be invoked with
  decorator-style `this`-binding.
- **Decorators are not decoratable.** Excluding `decorator` declarations from
  the attribute target set avoids needing topological ordering or cycle
  detection across decorators before any of them can be considered valid.
- **Name-keyed metadata, not shallow merge.** Keying by decorator name instead
  of shallow-merging each decorator's result makes key collisions structurally
  impossible instead of silently "later wins," and lets a decorator return any
  value (not just an object) without a special case.
- **Presence recorded unconditionally.** Without this, a purely observational
  decorator (an identity decorator with no meaningful return value) would be
  indistinguishable from "not applied," defeating its use as a marker.
- **Duplicate-application rejected by identity.** Silently allowing
  `[Token][Token]` would make written attribute lists misleading; rejecting it
  is a cheap, unambiguous check once `Name` is resolved.
- **`this` reused, not a new keyword.** `this` already means "the value this
  evaluation is about" (see `reference.spec.md`); rebinding it per evaluation
  phase is consistent with that meaning rather than introducing a second
  reserved word for the same concept.
- **`this` excludes in-progress metadata.** Restricting `this` to pre-decoration
  structural fields makes decorator invocation acyclic without a separate cycle
  check: a decorator that references `this.metadata` can never observe output
  that does not yet exist, so no runaway or nondeterministic-ordering hazard can
  arise from any decorator applied anywhere in a declaration's attribute list.
- **Metadata-only boundary.** Keeping decorators unable to change matching
  behavior means a rule's observable results never depend on which decorators
  were applied, which keeps this chapter's correctness reasoning simple:
  metadata can be added, removed, or reordered without ever changing what a
  grammar accepts. A rewriting mechanism, if pursued later, needs its own
  chapter and its own correctness argument.

## Failure surface

- An unresolvable decorator name, or a name that resolves to a `rule` or
  ordinary `func` rather than a `decorator` declaration, MUST fail the same way
  any unresolved reference fails.
- A duplicate decorator application (same resolved `DecoratorFunc` on one
  declaration) MUST fail declaration resolution deterministically.
- A decorator whose invocation raises an expression exception MUST fail
  declaration resolution with that exception, not silently skip the decorator.
- A decorator applied to a rule/func that it has no special relationship to (for
  example a general-purpose `[Deprecated]` decorator applied to many unrelated
  declarations) MUST NOT be specially rejected: it resolves and invokes exactly
  like any other decorator reference, and the `this`-exposure constraint above
  already prevents any self- or sibling-reference hazard regardless of which
  declaration a decorator is applied to.
