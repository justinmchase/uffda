# Func declaration syntax

This chapter defines Uffda `func` declaration forms for module-local callables.

## Logical purpose

Func declarations bind a name and a **parameter pattern** to an expression body
so modules can export and import callables without host `Native` or permanent
global std entries. Parameter patterns are Patterns-as-types: arguments are
matched before the body runs. See
[#124](https://github.com/justinmchase/uffda/issues/124). Remote package
consumption of funcs is deferred to
[#129](https://github.com/justinmchase/uffda/issues/129).

Rules and funcs share a Pattern → Expression idea but differ in required slots
and invocation site. See [rules and funcs](./rules-and-funcs.spec.md).

## Rough grammar

```text
"func" Identifier ( "<" Pattern ">" )? "=" Expression ";"
```

## Core func contracts

- Func declarations MUST include a stable identity (name).
- Func declarations MUST begin with one of the supported declaration headers:
  - `func`
  - `export func`
- Func declarations MUST place `=` between the identity (and any parameter list)
  and the expression body.
- Func declarations MAY include a parameter list in angle brackets immediately
  after the name.
- When a parameter list is present, its body MUST be parsed as PatternLang
  (space-separated patterns form a Then, same as pattern bodies).
- Canonical parameter forms include capture patterns such as `a:number`,
  `b:string`, and rest-style `a:any*`.
- Omitted parameter lists and empty `<>` MUST normalize to an `end` pattern
  (zero arguments).
- At invocation, the runtime MUST match the func's parameter pattern against the
  argument list as an iterable stream (no Into). The effective matcher MUST
  require full consumption (parameter pattern then `end`), except when the
  declared pattern is already `end`.
- Successful matches MUST bind PatternLang variables for the expression body.
- Failed argument matches MUST fail the invocation (same class of outcome as a
  failed lambda argument match).
- Func declarations MUST include an expression body slot parsed through
  `ExpressionLang`.
- Func declarations MUST NOT include a rule-style pattern body or a trailing
  `->` projection slot; the expression after `=` is the body.
- An exported func declaration MUST normalize to the same ordered syntax
  declarations as a standalone export immediately followed by the equivalent
  func declaration (`export func F = E;` ≡ `export F; func F = E;`).
- The canonical syntax tree MUST preserve the parameter pattern and expression
  body so runtime compilation can emit `FuncDeclaration`.

## Runtime compilation and resolution

- Compiling a func declaration MUST emit a `FuncDeclaration` on
  `ModuleDeclaration.funcs` (not on `rules`) with `pattern` and `expression`.
- Exporting a local func MUST use `ExportDeclarationKind.Func`.
- Standalone `export Name;` MUST resolve to a local rule, local func, or
  imported name via the same finalize/export classification used for rules.
- Importing a func name MUST bind a callable member; the name MUST NOT conflict
  with a local `rule` or local `func` in the importing module.
- Invoking a func MUST use ordinary ExpressionLang invocation `(Name arg…)`.
- Expression reference lookup MUST resolve local and imported funcs before
  std/globals so module funcs shadow same-named std helpers.
- Author-defined funcs MUST NOT be match-aware by default.

## Integration contracts

- Parameter slots MUST delegate parsing to `PatternLang`.
- Expression slots MUST delegate parsing to `ExpressionLang`.
- `func` MUST be a reserved declaration keyword (not a legal identifier token in
  Uffda declaration positions that use `IdentifierToken`).

## Failure surface

- Missing required func components MUST fail deterministically.
- Argument patterns that do not match MUST fail the invocation.
- Unknown exported or imported func names MUST fail module resolution.

## Bootstrap note

Authored language modules under `src/lang/` MUST NOT use `func` until a
published CLI includes UffdaLang and runtime-compiler support for this family.
Defining the `func` grammar itself in `.uff` is allowed under the published
feature surface.
