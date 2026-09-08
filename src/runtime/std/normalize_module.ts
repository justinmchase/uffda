import { ExportDeclarationKind } from "../declarations/export.ts";
import type { ExportDeclaration } from "../declarations/export.ts";
import type { ModuleDeclaration } from "../declarations/module.ts";
import type { RuleDeclaration } from "../declarations/rule.ts";
import type { ImportDeclaration } from "../declarations/import.ts";

/**
 * Normalize a lowered runtime module’s exports (conversion blocker for
 * `uffda/runtime.compiler`).
 *
 * Bare `export Name` syntax always lowers as a rule export. When `Name` is
 * imported and not declared as a local rule, rewrite it to an import export so
 * barrel modules can re-export without a local rule body.
 *
 * Authors write `(normalizeModule m)` after compiling declaration lists.
 */
export function normalizeModule(module: {
  imports: ImportDeclaration[];
  exports: ExportDeclaration[];
  rules: RuleDeclaration[];
}): ModuleDeclaration {
  const ruleNames = new Set(module.rules.map((rule) => rule.name));
  const importedNames = new Set(
    module.imports.flatMap((item) => item.names),
  );
  return {
    imports: module.imports,
    rules: module.rules,
    exports: module.exports.map((item) => {
      if (
        item.kind === ExportDeclarationKind.Rule &&
        !ruleNames.has(item.name) &&
        importedNames.has(item.name)
      ) {
        return item.default
          ? {
            kind: ExportDeclarationKind.Import,
            name: item.name,
            default: true,
          }
          : {
            kind: ExportDeclarationKind.Import,
            name: item.name,
          };
      }
      return item;
    }),
  };
}
