---
id: modules-runtime-005
title: Import-caused resolution errors carry the chain of import edges
spec_ref: ".agents/specifications/modules.spec.md#error-and-determinism-requirements"
---

# Import Failures Carry The Import Chain

## Requirement

Preconditions:

- `Resolver.import(moduleUrl)` resolves a `ModuleDeclaration` whose `imports`
  reference other modules.

Expected behavior:

- When resolving an imported module fails, or an import's `names` are invalid
  (unknown export, or a conflict with a local rule/func/decorator), the returned
  `ModuleImportError` MUST carry `importChain`: one frame per import edge from
  the requested module down to the module whose import failed, outermost first.
- Each frame MUST record the importing module's URL (`importerUrl`), the 0-based
  index of the import within that module's `imports` (`importIndex`), the
  import's specifier as written (`moduleUrl`), and the specifier resolved
  against the importer (`resolvedUrl`).
- Errors not caused by an import (for example an unknown export of a local rule)
  MUST NOT carry an `importChain`.
- The chain MUST be deterministic for a fixed resolver configuration and module
  graph.

Postconditions:

- Tooling can attribute any import-caused resolution error to the root module's
  import declaration at `importChain[0].importIndex` without re-parsing error
  messages (see
  [cli-language-server 004](../cli-language-server/004-diagnostics.requirement.md)).
