# Resolve pattern

This chapter defines the logical contract for name resolution across variable,
runtime-supplied pattern, and rule scopes.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `resolve` pattern unifies three resolution contexts into a single primitive:
looking up a name from the current variable scope, runtime-supplied patterns
(specials), or named rules in the module. It provides a single ergonomic pattern
for all identifier-based matching.

## Behavioral expectations

- A `resolve` pattern MUST take an identifier name as its argument.
- Before binding a variable name with the syntax `name:pattern`, the runtime
  MUST check that `name` does not already exist in any of: the current variable
  scope, the set of runtime-supplied patterns, or the module's rule definitions.
  If a conflict is detected, the runtime MUST report a scope-conflict error.
- When resolving a name at match time, the runtime MUST check scopes in order:
  1. **Variable scope** (local captured values)
  2. **Runtime-supplied patterns** (specials)
  3. **Rule definitions** (module rules)
- On the first match, the runtime MUST use the resolved value or pattern.
- If the name is not found in any scope, the runtime MUST report a resolution
  error.
- Resolution MUST use the resolved value or pattern according to its semantics:
  - A captured variable value is matched using `equal` semantics (strict
    equality).
  - A runtime-supplied pattern is evaluated as a pattern in the current context.
  - A rule is invoked with its formal parameters (if any).

## Left-recursion behavior

- If a rule is resolved, left-recursion seeding and growth apply according to
  the [direct left-recursion](../direct-left-recursion.spec.md) specification.
- If a variable value is resolved, it is matched using equality, which does not
  involve left-recursion.
- If a runtime-supplied pattern is resolved, left-recursion behavior depends on
  that pattern's own semantics.

## Input consumption

- A `resolve` pattern MUST consume input according to the semantics of the
  resolved value or pattern:
  - Variable values: exactly one item on success (strict equality match).
  - Runtime-supplied patterns: according to that pattern's consumption rules.
  - Rules: according to that rule's definition.

## Expected output

- On success, the `resolve` pattern MUST report the match result of the
  resolved value or pattern.
- On failure, the `resolve` pattern MUST report failure.

## Error conditions

- If a variable name conflicts with a rule name or runtime-supplied pattern
  during binding, the runtime MUST report a scope-conflict error before
  evaluation.
- If a name cannot be resolved to any scope at match time, the runtime MUST
  report a resolution error.
- If the resolved value or pattern itself fails, `resolve` propagates that
  failure.

## Side effects

- The `resolve` pattern MUST NOT produce externally observable side effects
  beyond its match result and the side effects of the resolved value or
  pattern.
- Variable binding (the `:name` syntax) creates a side effect in the current
  scope and MUST be validated for conflicts before match evaluation begins.

## Composition intent

- The `resolve` pattern SHOULD be used whenever an identifier needs to be
  matched against a previously captured value, a runtime-supplied pattern, or
  a named rule.
- The `resolve` pattern enables paired delimiters (matching closing delimiter
  against opening), repeated tokens, contextual matching, and rule composition.
- The `resolve` pattern MAY be composed with sequencing, alternation, and
  quantification.

## Examples

### Resolving a captured variable — matching paired quote marks

Match balanced quoted strings where the opening and closing delimiters must be
identical (e.g., `"..."` or `'...'`).

```
// Pattern object
then([
  quote:includes(["\"", "'"]),
  quantifier(except(resolve(quote))),
  resolve(quote)
])
```

```
// Grammar rule
QuotedString = quote:("\"" | "'") ~quote* quote
```

Input `"\"hello\""` succeeds with `quote = "\""`, consumes `hello` (any 
character except `"`), then matches the closing `"`. Input `"\"hello'"` fails 
because the closing quote doesn't match the opening quote.

---

### Resolving a captured variable — matching paired XML tags

Capture a tag name and verify that the closing tag matches the opening tag.

```
// Pattern object
then([
  equal("<"),
  name:identifier,
  equal(">"),
  ... content ...,
  equal("</"),
  resolve(name),
  equal(">")
])
```

```
// Grammar rule
Tag = "<" name:identifier ">" content:(...) "</" name ">"
```

Input `"<foo>...</foo>"` succeeds with `name = "foo"` and `resolve(name)`
matches `"foo"` in the closing tag. Input `"<foo>...</bar>"` fails because the
closing tag name doesn't match.

---

### Resolving a rule — invoking a named rule

Invoke a named rule from within a pattern sequence.

```
// Pattern object
then([
  resolve("Expression"),
  equal(","),
  resolve("Expression")
])
```

```
// Grammar rule
Pair = resolve(Expression) "," resolve(Expression)
```

Or more naturally in grammar sugar:

```
Pair = Expression "," Expression
```

When a bare identifier appears in grammar syntax, it is implicitly a rule
lookup (syntactic sugar for `resolve`).

---

### Resolving a runtime-supplied pattern — metaprogramming

Invoke a pattern that was supplied at runtime (a special pattern).

```
// Pattern object
then([
  resolve("customParser"),
  equal(";")
])
```

```
// Grammar rule with pattern interpolation
Statement = customParser ";"
```

The `customParser` is a runtime-supplied pattern (special). At match time,
`resolve` finds it in the runtime context, evaluates it, and continues. This
enables metaprogramming scenarios where grammar rules are composed dynamically.

---

### Scope precedence: variable shadows rule

When a variable is bound with the same name as a rule, the variable takes
precedence in resolution.

```
// Pattern object
then([
  x:equal("hello"),    // capture "hello" into variable x
  resolve(x)           // resolve looks up x in variables first, finds "hello"
])
```

```
// Grammar rule
Message = x:"hello" x
```

This would match input `["hello", "hello"]` (two copies).

If instead the rule is never shadowed:

```
Word = "hello"
Message = Word "," Word
```

Both `Word` references resolve to the rule (no conflict).

---

### Scope conflict error: duplicate variable binding

Attempting to bind a variable name that conflicts with a rule or special raises
a compile-time error.

```
// Grammar rule — CONFLICT
Word = "hello"
Example = Word:Word ...  // ✗ error: Word already defined (rule name)
```

```
// Grammar rule — CONFLICT
Example = x:Word x:Number ...  // ✗ error: x already defined (duplicate binding)
```

```
// Grammar rule — OK
Example = x:Word y:Number ...  // ✓ ok: x and y are distinct variables
Example2 = x:Word "," y:Word x ...  // ✓ ok: resolve(x) finds variable x
```

