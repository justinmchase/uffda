/**
 * `@justinmchase/uffda` on JSR after the Rust production cutover.
 *
 * The Deno TypeScript runtime/CLI library is no longer published here. Install
 * the Rust `uffda` binary from GitHub Releases (or use crates.io). This package
 * still ships `uffda.jsonc`, `.uff` sources under `src/lang/`, and compiled
 * `./bin` ModuleDeclarations so `jsr:@justinmchase/uffda/<export>` grammar
 * imports remport.
 */

/** Runtime that consumers should use. */
export const RUNTIME = "rust" as const;

/** One-line cutover notice. */
export const NOTICE =
  "Uffda's TypeScript runtime and CLI have moved to the Rust `uffda` binary. " +
  "This JSR package no longer exports Deno library APIs (`./grammar`, " +
  "`./runtime`, and similar subpaths).";

/** Linux install one-liner for the release CLI. */
export const CLI_INSTALL =
  "curl -fsSL https://github.com/justinmchase/uffda/releases/latest/download/install.sh | bash";

/** Repository / docs URL. */
export const DOCS_URL = "https://github.com/justinmchase/uffda";

/** Where compiled grammar artifacts live inside this package. */
export const GRAMMARS_NOTE =
  "Compiled ModuleDeclaration artifacts are under ./bin and `.uff` sources " +
  "under ./src/lang. Import them as `jsr:@justinmchase/uffda/<export>` using " +
  "this package's uffda.jsonc exports (tokenizer, pattern, expression, …).";
