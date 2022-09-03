import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { IPipelinePattern, LangPatternKind } from "./lang.pattern.ts";

tests(() => [
  {
    id: "PEXPR00",
    pattern: () => TestLang,
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
    id: "PEXPR01",
    pattern: () => TestLang,
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
    id: "PEXPR02",
    pattern: () => TestLang,
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
    id: "PEXPR03",
    pattern: () => TestLang,
    input: "a -> $0 | b",
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
    id: "PEXPR04",
    pattern: () => TestLang,
    input: "a b -> $0",
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
    id: "PEXPR05",
    pattern: () => TestLang,
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
    id: "PEXPR06",
    pattern: () => TestLang,
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
    id: "PEXPR07",
    pattern: () => TestLang,
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
    id: "PEXPR08",
    pattern: () => TestLang,
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
    id: "PEXPR09",
    pattern: () => TestLang,
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
    id: "PEXPR10",
    pattern: () => TestLang,
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
    id: "PEXPR11",
    pattern: () => TestLang,
    input: "any*",
    value: { kind: "ZeroOrMorePattern", pattern: { kind: "AnyPattern" } },
  },
  {
    id: "PEXPR12",
    pattern: () => TestLang,
    input: "ok*",
    value: { kind: "ZeroOrMorePattern", pattern: { kind: "OkPattern" } },
  },
  {
    id: "PEXPR13",
    pattern: () => TestLang,
    input: "string*",
    value: { kind: "ZeroOrMorePattern", pattern: { kind: "StringPattern" } },
  },
  {
    id: "PEXPR14",
    pattern: () => TestLang,
    input: "number*",
    value: { kind: "ZeroOrMorePattern", pattern: { kind: "NumberPattern" } },
  },
  {
    id: "PEXPR15",
    pattern: () => TestLang,
    input: "$0*",
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "SpecialReferencePattern", name: "$0" },
    },
  },
  {
    id: "PEXPR16",
    pattern: () => TestLang,
    input: "x*",
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "ReferencePattern", name: "x" },
    },
  },
  {
    id: "PEXPR17",
    pattern: () => TestLang,
    input: "'abc'*",
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "EqualPattern", value: "abc" },
    },
  },
  {
    id: "PEXPR18",
    pattern: () => TestLang,
    input: "1*",
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "EqualPattern", value: 1 },
    },
  },
  {
    id: "PEXPR18",
    pattern: () => TestLang,
    input: "(x)*",
    value: {
      kind: "ZeroOrMorePattern",
      pattern: { kind: "ReferencePattern", name: "x" },
    },
  },
]);
