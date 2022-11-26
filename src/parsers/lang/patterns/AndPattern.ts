import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { OrPattern } from "./OrPattern.ts";

export const AndPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./OrPattern.ts",
      module: OrPattern,
      names: ["OrPattern"],
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: LangPatternKind.AndPattern,
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
                  pattern: { kind: PatternKind.Reference, name: LangPatternKind.AndPattern },
                },
                {
                  kind: PatternKind.Object,
                  keys: {
                    kind: { kind: PatternKind.Equal, value: "Token" },
                    value: { kind: PatternKind.Equal, value: "&" },
                  },
                },
                {
                  kind: PatternKind.Variable,
                  name: "r",
                  pattern: { kind: PatternKind.Reference, name: LangPatternKind.OrPattern },
                },
              ],
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ l, r }) => ({
                kind: LangPatternKind.AndPattern,
                left: l,
                right: r,
              }),
            },
          },
          { kind: PatternKind.Reference, name: LangPatternKind.OrPattern },
        ],
      }
    }
  ],
};
