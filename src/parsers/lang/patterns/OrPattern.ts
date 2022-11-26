import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { ProjectionPattern } from "./ProjectionPattern.ts";

// OrPattern
//   = l:OrPattern '|' r:ProjectionPattern -> {
//       kind: LangPattern.OrPattern,
//       left: l,
//       right: r
//     }
//   | ProjectionPattern
export const OrPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: ProjectionPattern,
      moduleUrl: "./ProjectionPattern.ts",
      names: ["ProjectionPattern"],
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "OrPattern",
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
                  name: "l",
                  pattern: { kind: PatternKind.Reference, name: "OrPattern" },
                },
                {
                  kind: PatternKind.Object,
                  keys: {
                    kind: { kind: PatternKind.Equal, value: "Token" },
                    value: { kind: PatternKind.Equal, value: "|" },
                  },
                },
                {
                  kind: PatternKind.Variable,
                  name: "r",
                  pattern: {
                    kind: PatternKind.Reference,
                    name: "ProjectionPattern",
                  },
                },
              ],
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ l, r }) => ({
                kind: LangPatternKind.OrPattern,
                left: l,
                right: r,
              }),
            },
          },
          { kind: PatternKind.Reference, name: "ProjectionPattern" },
        ],
      },
    }
  ]
};
