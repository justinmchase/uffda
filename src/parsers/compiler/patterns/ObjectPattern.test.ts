import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ObjectPattern } from "./ObjectPattern.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "OBJECTPATTERN00",
    module: () => ObjectPattern,
    input: [
      {
        kind: LangPatternKind.ObjectPattern,
        keys: [
          {
            kind: LangPatternKind.ObjectKeyPattern,
            name: "x",
            pattern: { kind: LangPatternKind.OkPattern },
          },
        ],
      },
    ],
    value: {
      kind: PatternKind.Object,
      keys: {
        x: { kind: PatternKind.Ok },
      },
    },
  },
  {
    id: "OBJECTPATTERN01",
    module: () => ObjectPattern,
    input: [
      {
        kind: LangPatternKind.ObjectPattern,
        keys: [
          {
            kind: LangPatternKind.ObjectKeyPattern,
            name: "x",
          },
        ],
      },
    ],
    value: {
      kind: PatternKind.Object,
      keys: {
        x: { kind: PatternKind.Any },
      },
    },
  },
  {
    id: "OBJECTPATTERN02",
    module: () => ObjectPattern,
    input: [
      {
        kind: LangPatternKind.ObjectPattern,
        keys: [
          {
            kind: LangPatternKind.ObjectKeyPattern,
            alias: "x",
            name: "y",
          },
        ],
      },
    ],
    value: {
      kind: PatternKind.Object,
      keys: {
        y: {
          kind: PatternKind.Variable,
          name: "x",
          pattern: {
            kind: PatternKind.Any,
          },
        },
      },
    },
  },
  {
    id: "OBJECTPATTERN03",
    module: () => ObjectPattern,
    input: [
      {
        kind: LangPatternKind.ObjectPattern,
        keys: [
          {
            kind: LangPatternKind.ObjectKeyPattern,
            name: "x",
            must: true,
          },
        ],
      },
    ],
    value: {
      kind: PatternKind.Object,
      keys: {
        x: {
          kind: PatternKind.Must,
          pattern: {
            kind: PatternKind.Any,
          },
        },
      },
    },
  },
  {
    id: "OBJECTPATTERN04",
    module: () => ObjectPattern,
    input: [
      {
        kind: LangPatternKind.ObjectPattern,
        keys: [
          {
            kind: LangPatternKind.ObjectKeyPattern,
            alias: "x",
            name: "y",
            must: true,
          },
        ],
      },
    ],
    value: {
      kind: PatternKind.Object,
      keys: {
        y: {
          kind: PatternKind.Variable,
          name: "x",
          pattern: {
            kind: PatternKind.Must,
            pattern: {
              kind: PatternKind.Any,
            },
          },
        },
      },
    },
  },
  {
    id: "OBJECTPATTERN05",
    module: () => ObjectPattern,
    input: [
      {
        kind: LangPatternKind.ObjectPattern,
        keys: [
          {
            kind: LangPatternKind.ObjectKeyPattern,
            name: "x",
            pattern: {
              kind: LangPatternKind.MustPattern,
              pattern: {
                kind: LangPatternKind.StringPattern,
              },
            },
          },
        ],
      },
    ],
    value: {
      kind: PatternKind.Object,
      keys: {
        x: {
          kind: PatternKind.Must,
          pattern: {
            kind: PatternKind.String,
          },
        },
      },
    },
  },
]);
