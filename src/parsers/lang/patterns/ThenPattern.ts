import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/mod.ts";
import { MustPattern } from "./MustPattern.ts";

// ThenPattern
//   = left:ThenPattern right:NotPattern -> ({ type: 'ThenPattern', left right })
//   | NotPattern
export const ThenPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: MustPattern,
      moduleUrl: "./MustPattern.ts",
      names: ["MustPattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ThenPattern",
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
                  pattern: { kind: PatternKind.Reference, name: "ThenPattern" },
                },
                {
                  kind: PatternKind.Variable,
                  name: "right",
                  pattern: { kind: PatternKind.Reference, name: "MustPattern" },
                },
              ],
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ left, right }) => ({
                kind: LangPatternKind.ThenPattern,
                left,
                right,
              }),
            },
          },
          { kind: PatternKind.Reference, name: "MustPattern" },
        ],
      },
    },
  ],
};
