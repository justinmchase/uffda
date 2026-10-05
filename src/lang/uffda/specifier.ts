import { parseGrammar } from "../grammar.ts";
import { isClean, isSuccess, valueOf } from "../../match.ts";

/** The form of a module specifier (see `imports.spec.md` › Module specifiers). */
export enum ModuleSpecifierKind {
  /** A path relative to the importing module, starting with `./` or `../`. */
  Relative = "relative",
  /** A module name declared in the project file, starting with `@`. */
  Name = "name",
  /** A full JSR specifier, starting with `jsr:`. */
  Jsr = "jsr",
}

export type ModuleSpecifier = {
  kind: ModuleSpecifierKind;
  /** The specifier exactly as written. */
  text: string;
};

const SPECIFIER_RULES = new URL("./specifier.rules.uff", import.meta.url);

function kindOf(text: string): ModuleSpecifierKind {
  if (text.startsWith("jsr:")) return ModuleSpecifierKind.Jsr;
  if (text.startsWith("@")) return ModuleSpecifierKind.Name;
  return ModuleSpecifierKind.Relative;
}

/**
 * Reads `text` as a module specifier with the same grammar that reads one
 * between an import's quotes, or `undefined` when it is not one.
 */
export async function parseModuleSpecifier(
  text: string,
): Promise<ModuleSpecifier | undefined> {
  const match = await parseGrammar<string>({
    source: text,
    moduleUrl: SPECIFIER_RULES,
    entryRuleName: "ModuleSpecifierText",
  });
  if (!isSuccess(match) || !isClean(match)) return undefined;
  const parsed = valueOf(match);
  return { kind: kindOf(parsed), text: parsed };
}
