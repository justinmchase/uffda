import { fromFileUrl, resolve as resolvePath, toFileUrl } from "@std/path";
import { resolveGrammarModule } from "../lang/grammar.ts";
import type { Module } from "../runtime/modules/module.ts";
import { RuntimeSession } from "./mcp.session.ts";
import {
  isBuiltinUffdaLanguage,
  type LspLanguageConfigEntry,
} from "./lsp.config.ts";

/** The built-in Uffda language's own grammar module and entry rule. */
const UFFDA_MODULE_URL = new URL(
  "../lang/uffda/uffda.lang.uff",
  import.meta.url,
);
const UFFDA_ENTRY_RULE_NAME = "UffdaLang";

/** A configured language's resolved grammar: the module and rule to parse with. */
export type LanguageGrammar = {
  module: Module;
  entryRuleName: string;
};

export type LanguageGrammarResult =
  | { ok: true; grammar: LanguageGrammar }
  | { ok: false; message: string };

/**
 * The state of a grammar module open in the editor: the module its buffer
 * last compiled to, or `undefined` while the buffer has never compiled.
 */
export type OpenGrammarModule = { module?: Module };

type ModuleResult =
  | { ok: true; module: Module }
  | { ok: false; message: string };

/**
 * Resolves the grammar each configured language parses its documents with
 * (see
 * `.agents/requirements/cli-language-server/002-language-configuration.requirement.md`).
 *
 * A grammar module open in the editor is read from its buffer, through
 * `openModule`; otherwise it is compiled from disk through a
 * `RuntimeSession` rooted at the workspace (compiling its `.uff` imports into
 * the session artifact root on demand) and cached until `invalidate`. The
 * built-in Uffda language resolves the CLI's own bundled grammar.
 */
export class LspGrammarProvider {
  private readonly loaded = new Map<string, Promise<ModuleResult>>();

  constructor(
    private readonly workspaceRoot: string,
    private readonly openModule: (
      href: string,
    ) => OpenGrammarModule | undefined = () => undefined,
  ) {}

  /** The grammar module `language` parses with, or `undefined` if it names none. */
  public moduleUrlFor(language: LspLanguageConfigEntry): URL | undefined {
    if (isBuiltinUffdaLanguage(language)) return UFFDA_MODULE_URL;
    if (!language.modulePath) return undefined;
    return toFileUrl(resolvePath(this.workspaceRoot, language.modulePath));
  }

  /** The module and entry rule `language`'s documents parse with. */
  public async grammarFor(
    language: LspLanguageConfigEntry,
  ): Promise<LanguageGrammarResult> {
    const moduleUrl = this.moduleUrlFor(language);
    const entryRuleName = isBuiltinUffdaLanguage(language)
      ? UFFDA_ENTRY_RULE_NAME
      : language.entryRuleName;
    if (!moduleUrl || !entryRuleName) {
      return {
        ok: false,
        message:
          `Language "${language.id}" declares no grammar: set its "modulePath" and "entryRuleName"`,
      };
    }

    const loaded = await this.moduleFor(moduleUrl, entryRuleName);
    if (!loaded.ok) {
      return {
        ok: false,
        message: `Grammar for language "${language.id}" (${
          language.modulePath ?? moduleUrl.href
        }) is unavailable: ${loaded.message}`,
      };
    }
    const { module } = loaded;
    if (
      !module.rules.has(entryRuleName) && !module.imports.has(entryRuleName)
    ) {
      return {
        ok: false,
        message: `Grammar for language "${language.id}" (${
          language.modulePath ?? moduleUrl.href
        }) has no rule named "${entryRuleName}"`,
      };
    }
    return { ok: true, grammar: { module, entryRuleName } };
  }

  /** Drops the cached disk load of `href`, so the next lookup reloads it. */
  public invalidate(href: string): void {
    this.loaded.delete(href);
  }

  private moduleFor(
    moduleUrl: URL,
    entryRuleName: string,
  ): Promise<ModuleResult> {
    const open = this.openModule(moduleUrl.href);
    if (open) {
      return Promise.resolve(
        open.module ? { ok: true, module: open.module } : {
          ok: false,
          message: "its open document does not compile; see its diagnostics",
        },
      );
    }
    let loaded = this.loaded.get(moduleUrl.href);
    if (!loaded) {
      loaded = moduleUrl.href === UFFDA_MODULE_URL.href
        ? loadBundledModule(moduleUrl, entryRuleName)
        : this.loadWorkspaceModule(moduleUrl);
      this.loaded.set(moduleUrl.href, loaded);
    }
    return loaded;
  }

  private async loadWorkspaceModule(moduleUrl: URL): Promise<ModuleResult> {
    let source: string;
    try {
      source = await Deno.readTextFile(moduleUrl);
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    const session = new RuntimeSession(`grammar:${moduleUrl.href}`, {
      cwd: this.workspaceRoot,
    });
    try {
      const result = await session.load(source, fromFileUrl(moduleUrl));
      if (!result.ok) {
        const { message, location } = result.error;
        return {
          ok: false,
          message: location
            ? `${location.line + 1}:${location.column + 1}: ${message}`
            : message,
        };
      }
      const module = session.getModule(result.module.moduleUrl);
      return module
        ? { ok: true, module }
        : { ok: false, message: "module did not load" };
    } finally {
      session.close();
    }
  }
}

async function loadBundledModule(
  moduleUrl: URL,
  entryRuleName: string,
): Promise<ModuleResult> {
  const resolved = await resolveGrammarModule({ moduleUrl, entryRuleName });
  return resolved.ok
    ? { ok: true, module: resolved.resolved.module }
    : { ok: false, message: "the bundled grammar failed to resolve" };
}
