import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { PatternPattern } from "./PatternPattern.ts";

// The key of an object pattern which has a pattern
//
// e.g.
// key = pattern
export const ObjectKeyWithPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => PatternPattern,
      moduleUrl: "./PatternPattern.ts",
      names: ["PatternPattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ObjectKeyWithPattern",
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
                value: { kind: PatternKind.Equal, value: "=" },
              },
            },
            {
              kind: PatternKind.Variable,
              name: "pattern",
              pattern: {
                kind: PatternKind.Reference,
                name: LangPatternKind.PatternPattern,
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ name, pattern }) => ({
            kind: LangPatternKind.ObjectKeyPattern,
            name,
            pattern,
          }),
        },
      },
    },
  ],
};
