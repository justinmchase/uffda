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

- A module declaration MUST include imports, exports, rules, and funcs.
- Missing `funcs` on artifacts produced by older compilers MUST be treated as an
  empty funcs list.
- Rule declarations in a module MUST be addressable by declared rule name.
- Func declarations in a module MUST be addressable by declared func name.
- Exports MUST refer only to names that are valid rule exports, valid func
  exports, or valid resolved imports.
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
- Hosts MAY register immutable declaration JSON for deferred decoding. Such data
  MUST pass the normal declaration decoder on first access, be cached by URL,
  and never be executed or re-lowered. Invalid registered data MUST report a
  resolution error when loaded, not become a successful empty declaration.
- A relative import specifier MUST be resolved relative to the importing module
  URL. A module name MUST be resolved through the resolver's import map (see
  [Import maps](#import-maps)).
- Imported names MUST be validated against the imported module's exported names.
- Import names that conflict with rule or func declarations in the importing
  module MUST be rejected as module-resolution errors.

## Import maps

- A resolver MUST be given its import map before resolution starts: the
  `imports` of the [project file](./languages/project-file.spec.md#imports) the
  command uses, or none without a project. Source text never declares or carries
  an import map.
- A module name (a specifier starting with `@`) MUST resolve to the `jsr:`
  specifier of the alias it falls under, segment by segment, followed by the
  rest of the name: with `@acme/kv` mapped to `jsr:@acme/kv@^1.2.0`,
  `@acme/kv/tokens` resolves to `jsr:@acme/kv@^1.2.0/tokens`.
- A module name no alias covers MUST be a module-resolution error at that
  import, naming the specifier.
- Relative and `jsr:` specifiers MUST NOT be changed by the import map.
- The import map applies only to the project's own modules. An import in a
  package's module (see [Packages](#packages)) naming a module name MUST be a
  module-resolution error: published modules name their packages in full, and a
  package's import map is never read.

## Packages

A `jsr:@scope/name@range/export` module is loaded from JSR (`https://jsr.io/`)
the way Deno loads a `jsr:` import.

- **Version:** the version the lockfile records for `jsr:@scope/name@range`;
  else a version this resolver already chose for the package that satisfies the
  range, so one version serves the whole graph where it can; else the highest
  version in the package's `meta.json` that satisfies the range and is not
  yanked. A specifier without a range takes the highest stable version. No
  matching version MUST be a module-resolution error.
- **Export:** the package version's `uffda.jsonc` `exports` maps the export name
  (`.` when the specifier names none, else `./<export>`) to a `.uff` or `.json`
  file. An export the package does not declare, a package without a valid
  `uffda.jsonc`, or an export with any other extension MUST be a
  module-resolution error.
- **Identity:** the module's URL is that file's registry URL,
  `https://jsr.io/@scope/name/<version>/<path>`, so two specifiers that choose
  the same version and file are one module. Relative imports in it resolve
  against that URL, within the package version.
- **Declaration:** the module's declaration is its compiled artifact in the
  package's [artifact layout](./languages/project-file.spec.md#output-directory)
  within the package version: prefer `<outDir>/ast/<path>.uff.ast.json` (JSON),
  else `<outDir>/ast/<path>.uff.ast` (data codec). A package supplies `.uff` and
  `.json` modules only. A `.json` module loads its actual file as declaration
  data without artifact remapping. Any other extension MUST be a
  module-resolution error.
- **Integrity:** every file read from a package version MUST match the sha256
  checksum its `<version>_meta.json` manifest lists for it; a file the manifest
  does not list MUST be an error. When the lockfile records an integrity for the
  package version, its `<version>_meta.json` MUST match it.
- **Cache:** downloads are kept under `<cache>/uffda/jsr/`, mirroring their
  registry paths, where `<cache>` is `XDG_CACHE_HOME`, else `LOCALAPPDATA`, else
  `$HOME/.cache`. A file missing from the cache MUST be downloaded when a module
  needs it, and a cached file MUST be verified again when read. `meta.json`,
  which changes as versions are published, MUST be fetched afresh when a version
  is chosen from it, and read from the cache only when fetching fails.
- **Lockfile:** the [project file](./languages/project-file.spec.md#lockfile)'s
  `uffda.lock` records every version chosen and every package version's
  integrity, and is written when resolution adds to it. Without a project there
  is no lockfile.
- Every failure (an unreachable registry, an unknown package, an integrity
  mismatch, a missing export or artifact) MUST be a module-resolution error
  naming the module.

## Supported module sources

### Retired executable declaration-file imports

- The runtime MUST reject arbitrary `.ts` and `.js` declaration-file imports
  before reading or executing them. Custom extension resolvers MUST NOT
  re-enable these imports.
- This restriction does not prohibit explicitly supplied declaration objects or
  host APIs. Their URLs are identities, not permission to load executable files.

### JSON declaration modules

- The runtime MUST support loading declaration modules from `.json` sources.
- JSON declaration modules MUST be treated as declaration-bearing module sources
  and validated using the module declaration contract. JSON is read as data,
  never through executable host-module loading.
- JSON parsing or import failures MUST surface as module-resolution errors.

### Uffda source imports (`.uff`)

- Runtime resolution MUST support logical module URLs ending in `.uff`.
- A `.uff` import MUST NOT load or parse the `.uff` source text at resolution
  time.
- A `.uff` import MUST remap to its compiled artifact in the resolver's artifact
  layout (see
  [output directory](./languages/project-file.spec.md#output-directory)): the
  module `<root>/<path>.uff` loads `<outDir>/ast/<path>.uff.ast.json` when that
  file exists, else `<outDir>/ast/<path>.uff.ast`—the paths CLI compile writes.
  A resolver MUST be given its layout before resolution starts, as it is given
  its import map; without one it uses the working directory and `./bin`.
- A `.uff` module outside the layout's root MUST fail as a module-resolution
  error naming the module and the root.
- The runtime MUST load that artifact as a ModuleDeclaration (JSON decode for
  `.uff.ast.json`, data-codec decode for `.uff.ast`). Resolution MUST NOT re-run
  the runtime compiler or re-lower the artifact; the
  [bootstrap recursion break](./languages/compiler-bootstrap.spec.md#compile-pipeline-and-recursion-break)
  applies uniformly to built-in and user modules.
- Module cache identity MUST remain the logical `.uff` URL; the artifact path is
  a load target only.
- Missing or unreadable artifacts, invalid codec or JSON text, and invalid
  declarations MUST surface as module-resolution errors.
- Direct `.json` imports MUST resolve to their actual paths without artifact
  remapping.

### Rust runtime compatibility boundary

- The Rust runtime MUST support `.uff` and `.json` module imports, including
  package exports resolving to either extension.
- Direct `.ts` and `.js` file imports MUST be rejected as module-resolution
  errors.
- Explicit CLI `--ast` input remains supported independently of module loading.
- Rust-native globals MUST provide the in-scope runtime capabilities; the Rust
  runtime MUST NOT use an embedded JavaScript engine to restore retired host
  imports.
- The retired TypeScript reference used the same supported file extensions;
  executing it is not required for Rust module acceptance.

### Native declaration imports

- TypeScript module import declarations MAY specify native imports that provide
  module declarations directly (inline declaration object or declaration
  factory).
- Native import declarations MUST resolve to module declarations before normal
  imported-name binding is applied.
- Native import declarations SHOULD be used for controlled host integration and
  test/runtime wiring where declaration modules are supplied programmatically.

## Export and visibility behavior

- Rule exports MUST expose runtime rules declared in the module.
- Func exports MUST expose runtime funcs declared in the module.
- Import exports MUST expose names previously resolved from module imports
  (rules or funcs).
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
- A module-resolution error caused while resolving an import (the imported
  module failed, or its import names were invalid) MUST identify the import
  edges that led to it: the chain of
  `(importer, import index, specifier,
  resolved URL)` frames from the
  requested module down to the failing module, outermost first, so tooling can
  attribute the error to a source location. An error about one imported name
  (unknown export or conflict) also identifies that name.

## Composition intent

- Module semantics SHOULD remain explicit and conservative so higher-level DSL
  layers can generate declarations predictably.
- Module resolution contracts SHOULD preserve stable error boundaries and
  diagnosable outcomes as runtime capabilities evolve.
