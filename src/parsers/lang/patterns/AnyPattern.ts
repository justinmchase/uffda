import { PatternKind } from "../../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../../runtime/expressions/expression.kind.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { TokenizerKind } from "../../tokenizer/Tokenizer.ts";

export const AnyPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: LangPatternKind.AnyPattern,
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: TokenizerKind.Identifier },
            value: { kind: PatternKind.Equal, value: PatternKind.Any },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: () => ({
            kind: LangPatternKind.AnyPattern,
          }),
        },
      },
    },
  ],
};
