import { fromFileUrl } from "@std/path";
import { compileUffdaSource } from "../lang/uffda/execute.ts";
import { isClean, isSuccess, valueOf } from "../match.ts";
import { ImportDeclarationKind } from "../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import { diagnoseRecoveries } from "./diagnostics.ts";
import { parseFailureMessage } from "./stream.ts";

export type ModuleGraphResult =
  | { ok: true; declarations: Record<string, ModuleDeclaration> }
  | { ok: false; moduleUrl: string; message: string };

/**
 * Compiles the `.uff` module at `moduleUrl` and every `.uff` module it imports
 * by relative path, in memory, keyed by module URL, so a grammar outside the
 * built-in languages resolves without compiled artifacts on disk. Resolve
 * itself still only loads declarations (see compiler-bootstrap).
 */
export async function compileModuleGraph(
  moduleUrl: URL,
): Promise<ModuleGraphResult> {
  const declarations: Record<string, ModuleDeclaration> = {};
  const pending = [moduleUrl];
  while (pending.length > 0) {
    const url = pending.shift()!;
    if (declarations[url.href]) continue;
    let source: string;
    try {
      source = await Deno.readTextFile(fromFileUrl(url));
    } catch (error) {
      return {
        ok: false,
        moduleUrl: url.href,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    const compiled = await compileUffdaSource(source);
    if (!isSuccess(compiled) || !isClean(compiled)) {
      const [recovery] = await diagnoseRecoveries(compiled);
      return {
        ok: false,
        moduleUrl: url.href,
        message: recovery?.message ?? await parseFailureMessage(compiled),
      };
    }
    const declaration = valueOf(compiled);
    declarations[url.href] = declaration;
    for (const imported of declaration.imports) {
      if (imported.kind !== ImportDeclarationKind.Module) continue;
      if (!imported.moduleUrl.startsWith(".")) {
        return {
          ok: false,
          moduleUrl: url.href,
          message:
            `imports "${imported.moduleUrl}", and loading modules from packages is not supported yet`,
        };
      }
      pending.push(new URL(imported.moduleUrl, url));
    }
  }
  return { ok: true, declarations };
}
