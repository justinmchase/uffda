import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { AndPattern } from "./AndPattern.ts";

// PipelinePattern
//   = l:PipelinePattern { type: 'Token', value: '>' } r:OrPattern
//   | OrPattern
//
// e.g.
// x > y > z
//
export const PipelinePattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: AndPattern,
      moduleUrl: "./AndPattern.ts",
      names: ["AndPattern"],
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: LangPatternKind.PipelinePattern,
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Projection,
            pattern: {
              kind: PatternKind.Then,
              patterns: [
                {
                  kind: PatternKind.Variable,
                  name: "left",
                  pattern: { kind: PatternKind.Reference, name: LangPatternKind.PipelinePattern },
                },
                {
                  kind: PatternKind.Object,
                  keys: {
                    kind: { kind: PatternKind.Equal, value: "Token" },
                    value: { kind: PatternKind.Equal, value: ">" },
                  },
                },
                {
                  kind: PatternKind.Variable,
                  name: "right",
                  pattern: { kind: PatternKind.Reference, name: "AndPattern" },
                },
              ],
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ left, right }) => ({
                kind: LangPatternKind.PipelinePattern,
                left,
                right,
              }),
            },
          },
          { kind: PatternKind.Reference, name: "AndPattern" },
        ],
      }
    }
  ],
};
