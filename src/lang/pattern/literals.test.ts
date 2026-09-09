import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ValueSourceKind } from "../../runtime/patterns/value_source.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./literals.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.literals",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "LITERALS_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(['"', "hello", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Equal,
          value: { kind: ValueSourceKind.Literal, value: "hello" },
        },
      }),
    });

    await t.step({
      name: "LITERALS_00A",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(['"', "\\", "t", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Equal,
          value: { kind: ValueSourceKind.Literal, value: "\t" },
        },
      }),
    });

    await t.step({
      name: "LITERALS_00B",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(['"', "\\", "n", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Equal,
          value: { kind: ValueSourceKind.Literal, value: "\n" },
        },
      }),
    });

    await t.step({
      name: "LITERALS_00C",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(['"', "\\", "r", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Equal,
          value: { kind: ValueSourceKind.Literal, value: "\r" },
        },
      }),
    });

    await t.step({
      name: "LITERALS_00D",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(['"', "\\", "\\", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Equal,
          value: { kind: ValueSourceKind.Literal, value: "\\" },
        },
      }),
    });

    await t.step({
      name: "LITERALS_00E",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(['"', "\\", '"', '"']),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Equal,
          value: { kind: ValueSourceKind.Literal, value: '"' },
        },
      }),
    });

    await t.step({
      name: "LITERALS_00F",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(['"', "\\", "t", "ab", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Equal,
          value: { kind: ValueSourceKind.Literal, value: "\tab" },
        },
      }),
    });

    await t.step({
      name: "LITERALS_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["in", "[", "x", "y", "]"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Includes,
          values: [{ kind: ValueSourceKind.Literal, value: "x" }, {
            kind: ValueSourceKind.Literal,
            value: "y",
          }],
        },
      }),
    });

    await t.step({
      name: "LITERALS_02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["1", ".", ".", "5"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Between,
          left: { kind: ValueSourceKind.Literal, value: 1 },
          right: { kind: ValueSourceKind.Literal, value: 5 },
        },
      }),
    });

    await t.step({
      name: "LITERALS_VALUE_SOURCE_EQUAL",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["$", "x"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Equal,
          value: { kind: ValueSourceKind.Variable, name: "x" },
        },
      }),
    });

    await t.step({
      name: "LITERALS_VALUE_SOURCE_BETWEEN",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["$", "a", ".", ".", "$", "b"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Between,
          left: { kind: ValueSourceKind.Variable, name: "a" },
          right: { kind: ValueSourceKind.Variable, name: "b" },
        },
      }),
    });
  },
});
