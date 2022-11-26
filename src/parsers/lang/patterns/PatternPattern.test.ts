import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { IPipelinePattern, LangPatternKind } from "../lang.pattern.ts";
import { PatternPattern } from "./PatternPattern.ts";

tests(() => [
  {
    id: "LANG.PATTERN.PATTERN00",
    module: () => PatternPattern,
    // input: "a > b & c",
    input: [
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: ">" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "&" },
      { kind: TokenizerKind.Identifier, value: "c" },
    ],
    value: {
      kind: LangPatternKind.PipelinePattern,
      left: {
        kind: LangPatternKind.ReferencePattern,
        name: "a",
      },
      right: {
        kind: LangPatternKind.AndPattern,
        left: {
          kind: LangPatternKind.ReferencePattern,
          name: "b",
        },
        right: {
          kind: LangPatternKind.ReferencePattern,
          name: "c",
        },
      },
    } as IPipelinePattern,
  },
  {
    id: "LANG.PATTERN.PATTERN01",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "&" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: ">" },
      { kind: TokenizerKind.Identifier, value: "c" },
    ],
    value: {
      kind: LangPatternKind.PipelinePattern,
      left: {
        kind: LangPatternKind.AndPattern,
        left: {
          kind: LangPatternKind.ReferencePattern,
          name: "a",
        },
        right: {
          kind: LangPatternKind.ReferencePattern,
          name: "b",
        },
      },
      right: {
        kind: LangPatternKind.ReferencePattern,
        name: "c",
      },
    } as IPipelinePattern,
  },
  {
    id: "LANG.PATTERN.PATTERN02",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "|" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "&" },
      { kind: TokenizerKind.Identifier, value: "c" },
    ],
    value: {
      kind: "AndPattern",
      left: {
        kind: "OrPattern",
        left: { kind: "ReferencePattern", name: "a" },
        right: { kind: "ReferencePattern", name: "b" },
      },
      right: { kind: "ReferencePattern", name: "c" },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN03",
    future: true,
    module: () => PatternPattern,
    // input: "(a -> $0) | b",
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Token, value: ">" },
      { kind: TokenizerKind.SpecialIdentifier, value: "$0" },
      { kind: TokenizerKind.Token, value: ")" },
      { kind: TokenizerKind.Token, value: "|" },
      { kind: TokenizerKind.Identifier, value: "b" },
    ],
    value: {
      kind: "OrPattern",
      left: {
        kind: "ProjectionPattern",
        pattern: { kind: "ReferencePattern", name: "a" },
        expression: { kind: "SpecialReferenceExpression", name: "$0" },
      },
      right: { kind: "ReferencePattern", name: "b" },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN04",
    future: true,
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Token, value: ">" },
      { kind: TokenizerKind.SpecialIdentifier, value: "$0" },
      { kind: TokenizerKind.Token, value: ")" },
    ],
    value: {
      kind: "ProjectionPattern",
      pattern: {
        kind: "ThenPattern",
        left: { kind: "ReferencePattern", name: "a" },
        right: { kind: "ReferencePattern", name: "b" },
      },
      expression: { kind: "SpecialReferenceExpression", name: "$0" },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN05",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "!" },
      { kind: TokenizerKind.Identifier, value: "b" },
    ],
    value: {
      kind: "ThenPattern",
      left: {
        kind: "MustPattern",
        name: "PatternExpected",
        description: "ReferencePattern is expected",
        pattern: { kind: "ReferencePattern", name: "a" },
      },
      right: { kind: "ReferencePattern", name: "b" },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN06",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Token, value: "^" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "!" },
    ],
    value: {
      kind: "MustPattern",
      name: "PatternExpected",
      description: "NotPattern is expected",
      pattern: {
        kind: "NotPattern",
        pattern: { kind: "ReferencePattern", name: "a" },
      },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN07",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Token, value: "^" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: ":" },
      { kind: TokenizerKind.Identifier, value: "b" },
    ],
    value: {
      kind: "NotPattern",
      pattern: {
        kind: "VariablePattern",
        name: "a",
        pattern: { kind: "ReferencePattern", name: "b" },
      },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN08",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: ":" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "+" },
    ],
    value: {
      kind: "VariablePattern",
      name: "a",
      pattern: {
        kind: "OneOrMorePattern",
        pattern: { kind: "ReferencePattern", name: "b" },
      },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN09",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: ":" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "*" },
    ],
    value: {
      kind: "VariablePattern",
      name: "a",
      pattern: {
        kind: "ZeroOrMorePattern",
        pattern: { kind: "ReferencePattern", name: "b" },
      },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN10",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: ":" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "?" },
    ],
    value: {
      kind: "VariablePattern",
      name: "a",
      pattern: {
        kind: "ZeroOrOnePattern",
        pattern: { kind: "ReferencePattern", name: "b" },
      },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN11",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "any" },
      { kind: TokenizerKind.Token, value: "*" },
    ],
    value: { kind: "ZeroOrMorePattern", pattern: { kind: "AnyPattern" } },
  },
  {
    id: "LANG.PATTERN.PATTERN12",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "ok" },
      { kind: TokenizerKind.Token, value: "*" },
    ],
    value: { kind: "ZeroOrMorePattern", pattern: { kind: "OkPattern" } },
  },
  {
    id: "LANG.PATTERN.PATTERN13",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "string" },
      { kind: TokenizerKind.Token, value: "*" },
    ],
    value: { kind: "ZeroOrMorePattern", pattern: { kind: "StringPattern" } },
  },
  {
    id: "LANG.PATTERN.PATTERN14",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "number" },
      { kind: TokenizerKind.Token, value: "*" },
    ],
    value: { kind: "ZeroOrMorePattern", pattern: { kind: "NumberPattern" } },
  },
  {
    id: "LANG.PATTERN.PATTERN15",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.SpecialIdentifier, value: "$0" },
      { kind: TokenizerKind.Token, value: "*" },
    ],
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "SpecialReferencePattern", name: "$0" },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN16",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "*" },
    ],
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "ReferencePattern", name: "x" },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN17",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.String, value: "abc" },
      { kind: TokenizerKind.Token, value: "*" },
    ],
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "EqualPattern", value: "abc" },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN18",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Integer, value: 1 },
      { kind: TokenizerKind.Token, value: "*" },
    ],
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "EqualPattern", value: 1 },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN19",
    module: () => PatternPattern,
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: ")" },
      { kind: TokenizerKind.Token, value: "*" },
    ],
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "ReferencePattern", name: "x" },
    },
  },
]);
