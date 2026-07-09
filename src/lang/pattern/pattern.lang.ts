import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { Scope } from "../../runtime/scope.ts";
import { std } from "../../runtime/std/mod.ts";
import { resolve } from "../../runtime/patterns/resolve.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";
import { Resolver } from "../../mod.ts";
import type { Match } from "../../mod.ts";
import type { Pattern } from "../../runtime/patterns/pattern.ts";

export type PatternOptions = {
  globals?: Map<string, unknown>;
  declarations?: Record<string, ModuleDeclaration>;
};

export async function patternGrammar(
  pattern: string,
  opts?: PatternOptions,
): Promise<Match<Pattern>> {
  const { globals, declarations } = opts ?? {};
  const g = globals ?? std;
  const r = new Resolver({ declarations });
  const s = Scope
    .From(pattern)
    .withOptions({ globals: g, resolver: r });
  const m = await r.import(new URL(import.meta.url), {
    scope: s,
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: "PatternLang",
    },
  });
  if (m.kind === ModuleImportResultKind.Error) {
    return m.error;
  }

  const scoped = s.pushModule(m.module);

  const parsed = await resolve(
    {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: "PatternLang",
    },
    scoped,
  );

  if (parsed.kind === MatchKind.Ok) {
    return {
      ...parsed,
      value: parsed.value as Pattern,
    };
  }

  return parsed;
}

export const PatternLang: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../source-normalization/mod.ts",
      names: [
        "SourceNormalizationAndIndex",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../tokenizer/mod.ts",
      names: [
        "TokenizerNoWhitespace",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./pattern.ts",
      names: [
        "Pattern",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "PatternLang",
      default: true,
    },
  ],
  rules: [
    {
      name: "PatternLang",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Pipeline,
              steps: [
                {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "SourceNormalizationAndIndex",
                  args: [],
                },
                {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "TokenizerNoWhitespace",
                  args: [],
                },
                {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "Pattern",
                  args: [],
                },
              ],
            },
          },
          {
            kind: PatternKind.End,
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ pattern }): Pattern => pattern as Pattern,
      },
    },
  ],
};

export default PatternLang;
