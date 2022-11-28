import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/mod.ts";
import { TerminalPattern } from "./TerminalPattern.ts";

export const ZeroOrMorePattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: TerminalPattern,
      moduleUrl: "./TerminalPattern.ts",
      names: ["TerminalPattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ZeroOrMorePattern",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Variable,
              name: "pattern",
              pattern: { kind: PatternKind.Reference, name: "TerminalPattern" },
            },
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: "*" },
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ pattern }) => ({
            kind: LangPatternKind.ZeroOrMorePattern,
            pattern,
          }),
        },
      },
    },
  ],
};
