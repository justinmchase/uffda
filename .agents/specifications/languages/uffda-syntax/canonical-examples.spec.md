# Canonical executable examples

This chapter defines canonical Uffda module examples that are intended to parse,
compile to runtime `ModuleDeclaration`, and execute successfully.

## Purpose

Canonical examples provide end-to-end fixtures that validate language behavior
across parsing, module compilation, and runtime execution.

## Contracts

- Canonical examples MUST be valid Uffda module documents.
- Canonical examples MUST parse successfully through `UffdaLang`.
- Canonical examples MUST compile into executable runtime `ModuleDeclaration`
  structures.
- Canonical examples MUST execute successfully with deterministic outputs.

## Canonical examples

- Identity example:
  - Source: `export Main; rule Main = any;`
  - Entry rule: `Main`
  - Input: `"z"`
  - Output: `"z"`

- Projection example:
  - Source: `export rule One = any -> 1;`
  - Entry rule: `One`
  - Input: `"z"`
  - Output: `1`

- Morse language example:
  - The module uses `=` between each rule name and pattern body.
  - Every encoded symbol ends with `/` in the input character stream.
  - Source fixture: `MorseLang` in `src/lang/uffda/morse.lang.ts`.
  - Entry rule: `Morse`
  - Input: `".../---/.../"`
  - Output: `"SOS"`
