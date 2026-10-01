# Reference expression

This chapter defines the contract for expression name resolution.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Logical purpose

Reference expressions resolve a name from expression-visible runtime context.

## Behavioral expectations

- The reserved name `_` MUST resolve to the current match value.
- The reserved name `this` MUST resolve to the current successful `MatchOk`
  itself (not just its value). Reading its source span this way is allowed, but
  foundational components MUST NOT rely on it for provenance (see
  [value provenance](../runtime/value-provenance.spec.md#data-model)).
- Within decorator invocation (a distinct evaluation phase from match-time
  expression evaluation), `this` MUST instead resolve to the `Rule` or `Func`
  declaration being decorated; see
  [runtime rule metadata](../runtime/rule-metadata.spec.md).
- For non-reserved names, resolution MUST check, in order: local match
  variables, then the module's local and imported funcs, then the module's local
  and imported rules, then configured runtime capabilities.
- The runtime capability set MAY include standard-library values and additional
  explicitly injected bindings.
- If a name is unresolved in all of these, evaluation MUST throw a reference
  exception.

## Rule references

A rule name in an expression names the rule as data, so that expressions (most
importantly decorator arguments such as `[Formatter UffdaFormat]`) can refer to
a rule without being able to run it.

- A name that resolves to a local or imported rule declaration MUST evaluate to
  that rule's **rule info**, a plain object:
  - `kind`: `"rule"`;
  - `name`: the rule's declared name;
  - `moduleUrl`: the URL of the module that declares the rule, even when the
    referencing module imports it;
  - `parameters`: the rule's parameter names, in declared order.
- Rule info MUST NOT include the rule's pattern, projection, module object, or
  metadata. Metadata is excluded because decorators run while metadata is being
  built, so it could be observed incomplete; a later revision MAY add fields.
- Rule info MUST be plain data: it MUST contain no functions or cycles, so it
  can be projected into results and serialized.
- Rule parameters (such as `L` in `rule Fit<B, L>`) are bound to patterns, not
  declarations, and MUST NOT resolve as rule references.
- Within decorator invocation, `this` MUST keep its meaning (the decorated
  declaration); a rule reference MUST NOT change it.

## Error conditions

- Unresolved names MUST throw a reference exception.

## Composition intent

- Reference expressions SHOULD be used for explicit dependency projection from
  scope and configured runtime capabilities.
