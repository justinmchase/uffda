# Modules specification

This chapter defines the top-level contract for module boundaries, loading,
visibility, and composition across Uffda programs.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

Modules provide the executable unit for Uffda rules and exports. Module
resolution defines how declarations are discovered, loaded, validated, composed,
and surfaced to runtime pattern execution.

## Module declaration model

- A module declaration MUST include imports, exports, and rules.
- Rule declarations in a module MUST be addressable by declared rule name.
- Exports MUST refer only to names that are valid rule exports or valid resolved
  imports.
- A module MAY define a single default export.
- A module MUST NOT define multiple default exports.

## Resolution context and boundary

- Module resolution MUST execute with explicit resolution context that includes
  caller scope and triggering resolve pattern.
- Resolution failures MUST be reported as runtime module-resolution errors
  attached to that context.
- Module resolution MUST return structured resolution outcomes and MUST NOT
  throw uncaught host exceptions as the public module-resolution result.

## Resolution flow

- Resolver implementations MUST cache resolved modules by canonical module URL.
- If a module URL is already cached, subsequent imports MUST reuse the cached
  runtime module instance.
- Module imports MUST be resolved relative to the importing module URL.
- Imported names MUST be validated against the imported module's exported names.
- Import names that conflict with rule declarations in the importing module MUST
  be rejected as module-resolution errors.

## Supported module sources

### JavaScript and TypeScript declaration modules

- Runtime resolution MUST support loading declaration modules from `.ts` and
  `.js` sources through host module import.
- A loaded declaration module MUST provide a default export containing a valid
  Uffda module declaration.
- If a declaration module omits the required default declaration export,
  resolution MUST fail with a module-resolution error.

### JSON declaration modules

- Runtime resolution MUST support loading declaration modules from `.json`
  sources.
- JSON declaration modules MUST be treated as declaration-bearing module sources
  and validated using the same declaration contract as `.ts`/`.js` sources.
- JSON parsing or import failures MUST surface as module-resolution errors.

### Native declaration imports

- Module import declarations MAY specify native imports that provide module
  declarations directly (inline declaration object or declaration factory).
- Native import declarations MUST resolve to module declarations before normal
  imported-name binding is applied.
- Native import declarations SHOULD be used for controlled host integration and
  test/runtime wiring where declaration modules are supplied programmatically.

## Export and visibility behavior

- Rule exports MUST expose runtime rules declared in the module.
- Import exports MUST expose names previously resolved from module imports.
- Unknown exported names MUST fail resolution as module-resolution errors.
- Unknown imported names MUST fail resolution as module-resolution errors.

## Error and determinism requirements

- Unknown file extensions MUST fail module resolution with module-resolution
  errors.
- Invalid declaration structure, unknown rule references in exports, unknown
  import exports, and duplicate defaults MUST fail module resolution with
  module-resolution errors.
- For fixed resolver configuration and fixed module graph, module-resolution
  outcomes MUST be deterministic.

## Composition intent

- Module semantics SHOULD remain explicit and conservative so higher-level DSL
  layers can generate declarations predictably.
- Module resolution contracts SHOULD preserve stable error boundaries and
  diagnosable outcomes as runtime capabilities evolve.
