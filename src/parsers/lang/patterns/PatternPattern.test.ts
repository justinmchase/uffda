import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { IPipelinePattern, LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "LANG.PATTERN.PATTERN00",
    pattern: () => PatternLang,
    input: "a > b & c",
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
    pattern: () => PatternLang,
    input: "a & b > c",
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
    pattern: () => PatternLang,
    input: "a | b & c",
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
    pattern: () => PatternLang,
    input: "(a -> $0) | b",
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
    pattern: () => PatternLang,
    input: "(a b -> $0)",
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
    pattern: () => PatternLang,
    input: "a! b",
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
    pattern: () => PatternLang,
    input: "^a!",
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
    pattern: () => PatternLang,
    input: "^a:b",
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
    pattern: () => PatternLang,
    input: "a:b+",
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
    pattern: () => PatternLang,
    input: "a:b*",
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
    pattern: () => PatternLang,
    input: "a:b?",
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
    pattern: () => PatternLang,
    input: "any*",
    value: { kind: "ZeroOrMorePattern", pattern: { kind: "AnyPattern" } },
  },
  {
    id: "LANG.PATTERN.PATTERN12",
    pattern: () => PatternLang,
    input: "ok*",
    value: { kind: "ZeroOrMorePattern", pattern: { kind: "OkPattern" } },
  },
  {
    id: "LANG.PATTERN.PATTERN13",
    pattern: () => PatternLang,
    input: "string*",
    value: { kind: "ZeroOrMorePattern", pattern: { kind: "StringPattern" } },
  },
  {
    id: "LANG.PATTERN.PATTERN14",
    pattern: () => PatternLang,
    input: "number*",
    value: { kind: "ZeroOrMorePattern", pattern: { kind: "NumberPattern" } },
  },
  {
    id: "LANG.PATTERN.PATTERN15",
    pattern: () => PatternLang,
    input: "$0*",
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "SpecialReferencePattern", name: "$0" },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN16",
    pattern: () => PatternLang,
    input: "x*",
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "ReferencePattern", name: "x" },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN17",
    pattern: () => PatternLang,
    input: "'abc'*",
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "EqualPattern", value: "abc" },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN18",
    pattern: () => PatternLang,
    input: "1*",
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "EqualPattern", value: 1 },
    },
  },
  {
    id: "LANG.PATTERN.PATTERN18",
    pattern: () => PatternLang,
    input: "(x)*",
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "ReferencePattern", name: "x" },
    },
  },
]);
