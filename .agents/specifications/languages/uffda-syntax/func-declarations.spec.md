# Func declaration syntax

This chapter defines Uffda `func` declaration forms for module-local callables.

## Logical purpose

Func declarations bind a name and ordered parameters to an expression body so
modules can export and import callables without host `Native` or permanent
global std entries. See
[#124](https://github.com/justinmchase/uffda/issues/124). Remote package
consumption of funcs is deferred to
[#129](https://github.com/justinmchase/uffda/issues/129).

## Core func contracts

- Func declarations MUST include a stable identity (name).
- Func declarations MUST begin with one of the supported declaration headers:
  - `func`
  - `export func`
- Func declarations MUST place `=` between the identity (and any parameter list)
  and the expression body.
- Func declarations MAY include ordered parameter lists.
- When a parameter list is present, it MUST use the same angle-bracket form as
  rules (`Name<P1, P2, …>`), with comma-separated parameter identifiers
  (trailing commas MAY be accepted).
- Parameter names MUST be identifiers; they bind as variables for the expression
  body when the func is invoked.
- Func declarations MUST include an expression body slot parsed through
  `ExpressionLang`.
- Func declarations MUST NOT include a pattern body or a trailing `->`
  projection slot; the expression after `=` is the body.
- An exported func declaration MUST normalize to the same ordered syntax
  declarations as a standalone export immediately followed by the equivalent
  func declaration (`export func F = E;` ≡ `export F; func F = E;`).
- The canonical syntax tree MUST preserve the ordered parameter list and
  expression body so runtime compilation can emit `FuncDeclaration`.

## Runtime compilation and resolution

- Compiling a func declaration MUST emit a `FuncDeclaration` on
  `ModuleDeclaration.funcs` (not on `rules`).
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

- Expression slots in func declarations MUST delegate parsing to
  `ExpressionLang` rather than duplicating expression grammar in the Uffda
  layer.
- `func` MUST be a reserved declaration keyword (not a legal identifier token in
  Uffda declaration positions that use `IdentifierToken`).

## Failure surface

- Missing required func components MUST fail deterministically.
- Arity mismatches at invocation MUST fail when the call is evaluated (v1 MAY
  throw like many std helpers).
- Unknown exported or imported func names MUST fail module resolution.

## Bootstrap note

Authored language modules under `src/lang/` MUST NOT use `func` until a
published CLI includes UffdaLang and runtime-compiler support for this family.
Defining the `func` grammar itself in `.uff` is allowed under the published
feature surface.
