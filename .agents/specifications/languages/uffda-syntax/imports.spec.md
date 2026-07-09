# Import declaration syntax

This chapter defines import-specific syntax contracts for Uffda modules.

## Logical purpose

Import declarations bind module dependency locations to one or more imported
rule names used by the current module.

## Core contracts

- A Uffda module MAY have zero import declarations.
- A Uffda module MAY have multiple import declarations that target different
  module paths.
- A Uffda module MAY repeat imports from the same module path across multiple
  declarations.
- A single import declaration MUST support one or more imported rule names.
- Multiple imported names in a single declaration MUST be whitespace-separated
  without commas.

## Canonical starter forms

- Single name import: `import "./module.ts" Name;`
- Multi-name import: `import "./module.ts" NameA NameB NameC;`

## Normalization contracts

- Import declarations SHOULD normalize to syntax nodes that preserve module
  source path and imported names in declaration order.
- Import syntax failures MUST remain deterministic at declaration boundaries.
