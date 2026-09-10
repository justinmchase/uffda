# Compiler and bootstrap progression layer

This chapter defines contracts for compiler progression and self-hosting
bootstrapping across language-layer versions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Logical purpose

The compiler/bootstrap layer governs how language stacks progress toward
self-hosting while maintaining deterministic and diagnosable behavior.

## Bootstrap definition

- Bootstrapping MUST mean: using the latest published Uffda CLI to compile the
  next version of Uffda.
- The published CLI product MUST consist of the runtime, the language layers,
  and the CLI compiler wrapper that imports those languages.
- The installed CLI (version N) MUST compile authored `.uff` using the language
  stack already baked into that binary. It MUST NOT require host TypeScript
  twins or `*.bootstrap.ts` stubs of in-tree `.uff` sources.
- Converted `.uff` language modules that the published CLI needs at parse time
  MUST be embedded as compiled `./bin` AST JSON via `deno compile --include`,
  and remapped from the binary extract root when `Deno.build.standalone` is
  true.
- After self-hosting, language definitions consumed by a released CLI binary
  MUST come from compiled artifacts rather than TypeScript module sources that
  define those languages.

## Published-compiler feature surface

- Language and CLI `.uff` sources that are compiled during bootstrap MUST be
  accepted by the latest published CLI (version N).
- Authors MUST NOT rely on syntax, std callables, pattern forms, or compiler
  behavior that exist only in the in-tree (version N+1) sources until those
  capabilities have shipped in a published CLI.
- New language features MUST land in a published release before any `.uff`
  module in the tree depends on them for compile-time acceptance.
- Authored `.uff` modules MUST stay within that published feature surface.
- Local and CI bootstrap of `./bin` (`deno task compile:lang`) MUST use the
  previous published `uffda compile` for the full parse + lower pipeline in one
  step (quoted glob such as `'src/lang/**/*.uff'`), producing ModuleDeclaration
  JSON directly. No separate in-tree lower stage or frozen compiler snapshot is
  needed once the published CLI includes that pipeline (0.1.17+).

## Compile pipeline and recursion break

The chicken/egg for a self-hosted runtime compiler is: compiling
`runtime.compiler.uff` into workspace `./bin` must not load that same artifact
through `Resolver.import` / `runUffdaRuntimeCompiler` while producing it. A
second chicken/egg is that in-tree `uffdaGrammar` resolves `uffda.lang.uff` from
workspace `./bin`, so an empty `./bin` cannot be filled by in-tree parse alone.

- `uffda compile` MUST be a single product pipeline: parse authored `.uff` to a
  syntax module, then run `UffdaRuntimeCompiler` as the next stage, then write
  the resulting **ModuleDeclaration** JSON (`imports` / `exports` / `rules`).
  The published CLI binary embeds this whole pipeline (0.1.17+), so invoking it
  externally (`uffda compile 'src/lang/**/*.uff' --out-dir ./bin`) already
  performs both stages.
- Bootstrap of workspace `./bin` (`deno task compile:lang`) MUST shell out to
  the **previous published `uffda` CLI** for the full parse + lower pipeline
  (embedded languages and compiler in that binary). It MUST NOT leave syntax
  ASTs as the final artifacts and MUST NOT commit seeds under `src/`.
- Once workspace `./bin` is populated, in-tree `uffda compile`
  (`src/cli/compile.ts`) MAY lower using `Resolver.import` of
  `runtime.compiler.uff` (`compileUffdaSyntaxModule` in
  `src/lang/uffda/execute.ts`), reading the ModuleDeclaration that the previous
  published CLI already produced under `./bin`. This is not the recursive case:
  the artifact being read was produced by an earlier, separate invocation of the
  previous published CLI, not by the in-tree compile call that is reading it.
- Runtime resolution of logical `.uff` URLs MUST load the mirrored
  ModuleDeclaration JSON only. It MUST NOT re-run the runtime compiler or parse
  `.uff` source text on import.
- Authors MUST NOT introduce host workarounds that park compiler JSON under
  `src/` or special-case the runtime compiler artifact path outside normal
  resolve.

## Artifact layout requirements

- Authored language and CLI sources for self-hosting MUST be expressible as
  `.uff` modules.
- Language source trees under `src/` MUST contain authored `.uff` sources and
  thin TypeScript hosts only. Compiler output JSON (ModuleDeclarations and
  similar artifacts) MUST NOT be committed under `src/`; those artifacts MUST
  live under `./bin/` (or another designated artifact root), produced by the
  compile pipeline above.
- When the published CLI lacks a feature needed to compile the next sources,
  authors MUST publish a new CLI that adds that feature and then compile with it
  — not by checking compiler output into `src/` and not by splitting lowering
  out of the compile pipeline.
- Compiling those sources MUST emit ModuleDeclaration JSON artifacts under
  `./bin/`.
- The next CLI binary MUST load language definitions from those `./bin/` JSON
  artifacts for the compiled product.
- Artifact paths and names under `./bin/` MUST be deterministic for a fixed
  source tree and compiler version.
- Runtime module imports that name a `.uff` source MUST resolve through that
  artifact remapping (logical `.uff` URL → mirrored
  `./bin/ast/.../*.uffda.ast.json`), not by reading `.uff` source text. See the
  [modules specification](../modules.spec.md#uffda-source-imports-uff).

## Bin artifact integrity (no post-compile hacks)

`./bin` ModuleDeclaration JSON MUST be exactly what the published
`uffda
compile` wrote. Authors and agents MUST NOT “fix” stale or incomplete
artifacts with host-side rewriters.

- `deno task compile:lang` MUST be only previous published
  `uffda compile 'src/lang/**/*.uff' --out-dir ./bin` (plus clearing `./bin`
  beforehand as the task already does). It MUST NOT chain Deno scripts, jq
  transforms, AST walkers, or other steps that mutate compiled JSON after
  compile.
- Authors MUST NOT add repository scripts or `compile.ts` hooks whose purpose is
  to patch, migrate, wrap, or rewrite fields inside built `./bin` output.
- When a language/runtime change requires a different shape of compiled AST (for
  example tagged value operands instead of bare literals), authors MUST:
  1. Land the emitter change in the compiler / PatternLang / ExpressionLang,
  2. **Publish** a CLI that includes that emitter,
  3. **Install** that published CLI,
  4. Run `compile:lang` again so **that** compiler regenerates `./bin`.
- Temporary **runtime** compatibility for artifacts still produced by an older
  published CLI (for example accepting legacy primitive equal operands until
  recompile) MAY exist for a single publish bridge. That compatibility MUST NOT
  rewrite `./bin` files, MUST NOT be wired into `compile:lang`, and MUST be
  removed in a follow-up once the new CLI has regenerated artifacts.
- Authors MUST NOT treat “post-process the bin” or “infer missing tags at load
  by duck-typing arbitrary objects” as substitutes for the publish → install →
  recompile cycle.

## Full-circle validation requirements

- Bootstrap workflows MUST include a full-circle test: compile Uffda sources
  with CLI version N, then use the resulting artifacts (or a CLI built from
  them) to compile the same sources again.
- The second compile MUST succeed for the fixed source tree and configuration
  used in the first compile.
- Bootstrap workflows SHOULD include additional regression tests over compiled
  outputs before those outputs are packaged into a CLI binary.
- Bootstrap workflows MUST preserve deterministic outcomes for fixed input,
  compiler version, and module graph.

## Bootstrap progression requirements

- Bootstrap progression MUST allow the current stable published CLI to compile
  the next language-layer and CLI version.
- That next version’s authored `.uff` sources MUST remain within the feature
  surface of the publishing CLI used to compile them (see
  [Published-compiler feature surface](#published-compiler-feature-surface)).
- Layer contracts MUST remain versionable so source and diagnostic provenance
  can be preserved across compiler upgrades from version N to N+1.

## Compatibility requirements

- Compiler/bootstrap contracts SHOULD define compatibility boundaries explicitly
  when evolving layer representations.
- Migration paths SHOULD preserve debuggability and source-context fidelity,
  especially for complex pattern and expression stacks.

## Composition intent

- Compiler/bootstrap contracts SHOULD support reuse by language stacks that
  share lower Uffda layers but define alternate top-level languages.
- Distribution of CLI binaries used for bootstrapping is defined in the
  [distribution and release](./cli/distribution-and-release.spec.md) chapter.
- Default language modules under `src/lang/` MUST be authored as `.uff` and
  loaded from compiled `./bin` ModuleDeclaration JSON. Thin TypeScript hosts MAY
  remain only for non-declaration helpers (for example types or host-side walks
  that are not ModuleDeclarations).
