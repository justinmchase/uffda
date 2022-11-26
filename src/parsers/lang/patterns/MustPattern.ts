import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { NotPattern } from "./NotPattern.ts";

export const MustPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    
    {
      kind: DeclarationKind.NativeImport,
      module: NotPattern,
      moduleUrl: "./NotPattern.ts",
      names: ["NotPattern"],
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "MustPattern",
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
                  name: "pattern",
                  pattern: {
                    kind: PatternKind.Reference,
                    name: LangPatternKind.NotPattern,
                  },
                },
                {
                  kind: PatternKind.Object,
                  keys: {
                    kind: { kind: PatternKind.Equal, value: "Token" },
                    value: { kind: PatternKind.Equal, value: "!" },
                  },
                },
              ],
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ pattern }) => ({
                kind: LangPatternKind.MustPattern,
                name: "PatternExpected",
                description: `${pattern.kind} is expected`,
                pattern,
              }),
            },
          },
          {
            kind: PatternKind.Reference,
            name: LangPatternKind.NotPattern,
          },
        ],
      },
    }
  ]
};
