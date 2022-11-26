import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";
import { OrPattern } from "./OrPattern.ts";

tests(() => [
  {
    id: "LANG.PATTERN.OR00",
    description: "can parse a reference expression",
    module: () => OrPattern,
    // input: "x | y",
    input: [
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "|" },
      { kind: TokenizerKind.Identifier, value: "y" },
    ],
    value: {
      kind: LangPatternKind.OrPattern,
      left: {
        kind: "ReferencePattern",
        name: "x",
      },
      right: {
        kind: "ReferencePattern",
        name: "y",
      },
    },
  },
  {
    id: "LANG.PATTERN.OR01",
    future: true,
    description: "can parse a projection expression",
    module: () => OrPattern,
    // input: "(x -> $0) | y",
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Token, value: ">" },
      { kind: TokenizerKind.SpecialIdentifier, value: "$0" },
      { kind: TokenizerKind.Token, value: ")" },
      { kind: TokenizerKind.Token, value: "|" },
      { kind: TokenizerKind.Identifier, value: "y" },
    ],
    value: {
      kind: LangPatternKind.OrPattern,
      left: {
        kind: LangPatternKind.ProjectionPattern,
        pattern: {
          kind: "ReferencePattern",
          name: "x",
        },
        expression: {
          kind: LangExpressionKind.SpecialReferenceExpression,
          name: "$0",
        },
      },
      right: {
        kind: "ReferencePattern",
        name: "y",
      },
    },
  },
  {
    id: "LANG.PATTERN.OR02",
    description: "can parse two then patterns",
    module: () => OrPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "w" },
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "|" },
      { kind: TokenizerKind.Identifier, value: "y" },
      { kind: TokenizerKind.Identifier, value: "z" },
    ],
    value: {
      kind: LangPatternKind.OrPattern,
      left: {
        kind: LangPatternKind.ThenPattern,
        left: {
          kind: LangPatternKind.ReferencePattern,
          name: "w",
        },
        right: {
          kind: LangPatternKind.ReferencePattern,
          name: "x",
        },
      },
      right: {
        kind: LangPatternKind.ThenPattern,
        left: {
          kind: LangPatternKind.ReferencePattern,
          name: "y",
        },
        right: {
          kind: LangPatternKind.ReferencePattern,
          name: "z",
        },
      },
    },
  },
]);
