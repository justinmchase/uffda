import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import {
  DeclarationKind,
  IModuleDeclaration,
} from "../../../runtime/declarations/mod.ts";

export const ObjectKeyMustPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ObjectKeyMustPattern",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Identifier" },
                value: {
                  kind: PatternKind.Variable,
                  name: "name",
                  pattern: { kind: PatternKind.String },
                },
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
          fn: ({ name }) => ({
            kind: LangPatternKind.ObjectKeyPattern,
            name,
            must: true,
          }),
        },
      },
    },
  ],
};
