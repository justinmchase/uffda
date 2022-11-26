import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";
import { ProjectionPattern } from "./ProjectionPattern.ts";

tests(() => [
  {
    id: "PROJECT00",
    module: () => ProjectionPattern,
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Token, value: ">" },
      { kind: TokenizerKind.SpecialIdentifier, value: "$0" },
      { kind: TokenizerKind.Token, value: ")" },
    ],
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
      expression: {
        kind: LangExpressionKind.SpecialReferenceExpression,
        name: "$0",
      },
    },
  },
  {
    id: "PROJECT01",
    module: () => ProjectionPattern,
    // input: "(x:y -> $0)",
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: ":" },
      { kind: TokenizerKind.Identifier, value: "y" },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Token, value: ">" },
      { kind: TokenizerKind.SpecialIdentifier, value: "$0" },
      { kind: TokenizerKind.Token, value: ")" },
    ],
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: {
        kind: LangPatternKind.VariablePattern,
        name: "x",
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "y",
        },
      },
      expression: {
        kind: LangExpressionKind.SpecialReferenceExpression,
        name: "$0",
      },
    },
  },
]);
