# Export declaration syntax

This chapter defines standalone export declaration contracts for Uffda modules.

## Logical purpose

Standalone export declarations publish module-facing names without requiring an
inline rule declaration at the same location.

## Core contracts

- Standalone export declarations MUST begin with the `export` declaration
  keyword.
- Direct-name export lists MUST support one or more exported names.
- Multiple exported names in a direct-name export list MUST be
  whitespace-separated without commas.
- Alias exports MUST bind exactly one alias to exactly one exported name per
  declaration.
- Alias export targets MUST NOT contain multiple exported names.
- A declaration MUST NOT mix direct-name lists and alias binding in the same
  export declaration.

## Canonical starter forms

- Direct name export: `export A;`
- Multi-name direct export: `export A B C;`
- Alias export: `export B = A;`

## Boundary and diagnostics

- Invalid standalone export forms MUST fail deterministically at declaration
  boundaries.
- Diagnostics SHOULD distinguish malformed direct-name lists from malformed
  alias exports.
