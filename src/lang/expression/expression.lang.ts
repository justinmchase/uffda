import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { exec } from "../../runtime/exec.ts";
import { Scope } from "../../runtime/scope.ts";
import { std } from "../../runtime/std/mod.ts";
import { resolve } from "../../runtime/patterns/resolve.ts";
import { Resolver } from "../../mod.ts";
import type { Match } from "../../mod.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";

export type ExprOptions = {
  globals?: Map<string, unknown>;
  declarations?: Record<string, ModuleDeclaration>;
};

export async function expr(
  expression: string,
  opts?: ExprOptions,
): Promise<Match> {
  const { globals, declarations } = opts ?? {};
  const g = globals ?? std;
  const r = new Resolver({ declarations });
  const m = await r.import(new URL(import.meta.url));
  const s = Scope
    .From(expression)
    .pushModule(m)
    .withOptions({ globals: g });

  return resolve(
    {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: "ExpressionLang",
    },
    s,
  );
}

export const ExpressionLang: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../tokenizer/mod.ts",
      names: [
        "Tokenizer",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./expression.ts",
      names: [
        "Expression",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "ExpressionLang",
    },
  ],
  rules: [
    {
      name: "ExpressionLang",
      parameters: [],
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Tokenizer",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Expression",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }, _specials, match) => exec(_, match),
      },
    },
  ],
};

export default ExpressionLang;
