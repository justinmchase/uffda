/**
 * Built-in language ModuleDeclarations keyed by absolute module URL.
 *
 * Deno-compiled CLI binaries cannot dynamically `import()` language modules from
 * the ephemeral compile root. Pre-registering remaining TypeScript language
 * modules keeps grammar loading working for both `deno run` and `deno compile`
 * products.
 *
 * Converted `.uff` modules are NOT registered here. The published CLI embeds
 * compiled `./bin` AST JSON (`deno compile --include`) and resolves logical
 * `.uff` URLs through artifact remapping. In-tree runs use the same remapping
 * against a workspace `./bin` after `compile:lang`.
 *
 * Language entry modules (`*.lang.ts`) are registered by their grammar helpers
 * to avoid an import cycle through `grammar.ts`.
 */
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";

import Literals from "./pattern/literals.ts";
import Source from "./source/mod.ts";
import Tokenizer from "./tokenizer/mod.ts";
import TokenizerLang from "./tokenizer/tokenizer.lang.ts";
const here = import.meta.url;

function entry(
  relativePath: string,
  declaration: ModuleDeclaration,
): [string, ModuleDeclaration] {
  return [new URL(relativePath, here).href, declaration];
}

export const builtInLanguageDeclarations: Record<string, ModuleDeclaration> =
  Object.fromEntries([
    entry("./pattern/literals.ts", Literals),
    entry("./source/mod.ts", Source),
    entry("./tokenizer/mod.ts", Tokenizer),
    entry("./tokenizer/tokenizer.lang.ts", TokenizerLang),
  ]);
