import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/mod.ts";
import { PatternPattern } from "./PatternPattern.ts";

export const ThenPattern: IModuleDeclaration = {
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
      name: "ThenPattern",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: "ThenPattern" },
            left: {
              kind: PatternKind.Variable,
              name: "left",
              pattern: { kind: PatternKind.Reference, name: "PatternPattern" },
            },
            right: {
              kind: PatternKind.Variable,
              name: "right",
              pattern: { kind: PatternKind.Reference, name: "PatternPattern" },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ left, right }) => ({
            kind: PatternKind.Then,
            patterns: [left, right],
          }),
        },
      },
    }
  ]
};
