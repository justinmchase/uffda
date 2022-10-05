import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { PatternCompiler } from "../PatternCompiler.ts";

tests(() => [
  {
    id: "OBJECTPATTERN00",
    description: "parses ObjectPattern into object pattern",
    pattern: () => PatternCompiler,
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
    pattern: () => PatternCompiler,
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
    pattern: () => PatternCompiler,
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
    pattern: () => PatternCompiler,
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
    pattern: () => PatternCompiler,
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
    pattern: () => PatternCompiler,
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
