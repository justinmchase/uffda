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

import Expression from "./expression/expression.ts";
import ExpressionLang from "./expression/expression.lang.ts";
import Member from "./expression/member.ts";
import NumberModule from "./expression/number.ts";
import Primary from "./expression/primary.ts";
import StringModule from "./expression/string.ts";
import Unary from "./expression/unary.ts";
import And from "./pattern/and.ts";
import Atomic from "./pattern/atomic.ts";
import Atoms from "./pattern/atoms.ts";
import Literals from "./pattern/literals.ts";
import Or from "./pattern/or.ts";
import PatternDeclaration from "./pattern/pattern.ts";
import PatternLang from "./pattern/pattern.lang.ts";
import Pipe from "./pattern/pipe.ts";
import Prefix from "./pattern/prefix.ts";
import Resolve from "./pattern/resolve.ts";
import Structure from "./pattern/structure.ts";
import Then from "./pattern/then.ts";
import Source from "./source/mod.ts";
import Tokenizer from "./tokenizer/mod.ts";
import TokenizerLang from "./tokenizer/tokenizer.lang.ts";
import ExportRules from "./uffda/export.rules.ts";
import ImportRules from "./uffda/import.rules.ts";
import RuleRules from "./uffda/rule.rules.ts";
import SharedRules from "./uffda/shared.rules.ts";

const here = import.meta.url;

function entry(
  relativePath: string,
  declaration: ModuleDeclaration,
): [string, ModuleDeclaration] {
  return [new URL(relativePath, here).href, declaration];
}

export const builtInLanguageDeclarations: Record<string, ModuleDeclaration> =
  Object.fromEntries([
    entry("./expression/expression.ts", Expression),
    entry("./expression/expression.lang.ts", ExpressionLang),
    entry("./expression/member.ts", Member),
    entry("./expression/number.ts", NumberModule),
    entry("./expression/primary.ts", Primary),
    entry("./expression/string.ts", StringModule),
    entry("./expression/unary.ts", Unary),
    entry("./pattern/and.ts", And),
    entry("./pattern/atomic.ts", Atomic),
    entry("./pattern/atoms.ts", Atoms),
    entry("./pattern/literals.ts", Literals),
    entry("./pattern/or.ts", Or),
    entry("./pattern/pattern.ts", PatternDeclaration),
    entry("./pattern/pattern.lang.ts", PatternLang),
    entry("./pattern/pipe.ts", Pipe),
    entry("./pattern/prefix.ts", Prefix),
    entry("./pattern/resolve.ts", Resolve),
    entry("./pattern/structure.ts", Structure),
    entry("./pattern/then.ts", Then),
    entry("./source/mod.ts", Source),
    entry("./tokenizer/mod.ts", Tokenizer),
    entry("./tokenizer/tokenizer.lang.ts", TokenizerLang),
    entry("./uffda/export.rules.ts", ExportRules),
    entry("./uffda/import.rules.ts", ImportRules),
    entry("./uffda/rule.rules.ts", RuleRules),
    entry("./uffda/shared.rules.ts", SharedRules),
  ]);
