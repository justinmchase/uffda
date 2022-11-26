import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/mod.ts";
import { PatternPattern } from "./PatternPattern.ts";

export const ZeroOrMorePattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => PatternPattern,
      moduleUrl: "./PatternPattern.ts",
      names: ["PatternPattern"],
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ZeroOrMorePattern",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: "ZeroOrMorePattern" },
            pattern: {
              kind: PatternKind.Variable,
              name: "pattern",
              pattern: { kind: PatternKind.Reference, name: "PatternPattern" },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ pattern }) => ({
            kind: PatternKind.Slice,
            min: 0,
            pattern,
          }),
        },
      },
    }
  ]
};
