import { tests } from "../../test.ts";
import { Meta } from "../meta.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

tests("parsers.compiler.objectpattern", () => [
  {
    id: "OBJECTPATTERN00",
    description: "parses ObjectPattern into object pattern",
    pattern: () => Meta,
    input: "{ x = ok }",
    value: {
      kind: PatternKind.Object,
      keys: {
        x: { kind: PatternKind.Ok },
      },
    },
  },
  {
    id: "OBJECTPATTERN01",
    description: "parses ObjectPattern into object pattern",
    pattern: () => Meta,
    input: "{ x }",
    value: {
      kind: PatternKind.Object,
      keys: {
        x: { kind: PatternKind.Any },
      },
    },
  },
  {
    id: "OBJECTPATTERN02",
    description: "{ x:y }",
    pattern: () => Meta,
    input: "{ x:y }",
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
    description: "{ x! }",
    pattern: () => Meta,
    input: "{ x! }",
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
    description: "{ x:y! }",
    pattern: () => Meta,
    input: "{ x:y! }",
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
    description: "{ x = string! }",
    pattern: () => Meta,
    input: "{ x = string! }",
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
