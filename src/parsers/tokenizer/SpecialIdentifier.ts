import { PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { Letter } from "./Letter.ts";
import { Digit } from "./Digit.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";

// Identifier = '$' (Digit | Character)+
export const SpecialIdentifier: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./Digit.ts",
      module: Digit,
      names: ["Digit"],
    },
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./Letter.ts",
      module: Letter,
      names: ["Letter"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "SpecialIdentifier",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            { kind: PatternKind.Equal, value: "$" },
            {
              kind: PatternKind.Variable,
              name: "value",
              pattern: {
                kind: PatternKind.Slice,
                min: 1,
                pattern: {
                  kind: PatternKind.Or,
                  patterns: [
                    {
                      kind: PatternKind.Reference,
                      name: "Digit",
                    },
                    {
                      kind: PatternKind.Reference,
                      name: "Letter",
                    },
                  ],
                },
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ value }) => `$${value.join("")}`,
        },
      },
    },
  ],
};
