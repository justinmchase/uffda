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
  - Source: `rule Main any;`
  - Input: `"z"`
  - Output: `"z"`

- Projection example:
  - Source: `rule One any -> 1;`
  - Input: `"z"`
  - Output: `1`
