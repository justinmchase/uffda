import { assertEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { expressionGrammar } from "../../lang/expression/expression.lang.ts";
import { assertGrammarCases } from "../../lang/grammar.ts";
import { std } from "../../runtime/std/mod.ts";
import { exec } from "../../runtime/exec.ts";
import type { Expression } from "../../runtime/expressions/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";

type WrapperKind = "array" | "object" | "string";
type LeafKind =
  | "array"
  | "object"
  | "number"
  | "string-literal"
  | "reference"
  | "boolean"
  | "null"
  | "undefined";

type Case = {
  id: number;
  expr1: WrapperKind;
  expr2: WrapperKind;
  expr3: LeafKind;
  syntax: string;
  expectedAst: Expression;
  expectedValue: unknown;
};

type CallCase = {
  id: number;
  leaf: LeafKind;
  syntax: string;
  expectedAst: Expression;
  expectedValue: unknown;
};

const wrappers: WrapperKind[] = ["array", "object", "string"];

const leaves: Array<{ name: LeafKind; syntax: string; value: unknown }> = [
  { name: "array", syntax: "[]", value: [] },
  { name: "object", syntax: "{}", value: {} },
  { name: "number", syntax: "0", value: 0 },
  { name: "string-literal", syntax: '"text-value"', value: "text-value" },
  { name: "reference", syntax: "ref", value: { from: "reference" } },
  { name: "boolean", syntax: "true", value: true },
  { name: "null", syntax: "null", value: null },
  { name: "undefined", syntax: "undefined", value: undefined },
];

function wrapSyntax(kind: WrapperKind, inner: string): string {
  switch (kind) {
    case "array":
      return `[${inner}]`;
    case "object":
      return `{value: ${inner}}`;
    case "string":
      return `"{${inner}}"`;
  }
}

function wrapAst(kind: WrapperKind, inner: Expression): Expression {
  switch (kind) {
    case "array":
      return {
        kind: ExpressionKind.Array,
        expressions: [
          {
            kind: ExpressionKind.ArrayElement,
            expression: inner,
          },
        ],
      };
    case "object":
      return {
        kind: ExpressionKind.Object,
        keys: [
          {
            kind: ExpressionKind.ObjectKey,
            name: "value",
            expression: inner,
          },
        ],
      };
    case "string":
      return {
        kind: ExpressionKind.String,
        values: [inner],
      };
  }
}

function wrapValue(kind: WrapperKind, inner: unknown): unknown {
  switch (kind) {
    case "array":
      return [inner];
    case "object":
      return { value: inner };
    case "string":
      return String(inner);
  }
}

function buildCases(): Case[] {
  const out: Case[] = [];
  let id = 1;

  for (const expr1 of wrappers) {
    for (const expr2 of wrappers) {
      for (const leaf of leaves) {
        const leafAst: Expression = (() => {
          switch (leaf.name) {
            case "array":
              return { kind: ExpressionKind.Array, expressions: [] };
            case "object":
              return { kind: ExpressionKind.Object, keys: [] };
            case "number":
              return { kind: ExpressionKind.Number, value: 0 };
            case "string-literal":
              return { kind: ExpressionKind.String, values: ["text-value"] };
            case "reference":
              return { kind: ExpressionKind.Reference, name: "ref" };
            case "boolean":
              return { kind: ExpressionKind.Boolean, value: true };
            case "null":
              return { kind: ExpressionKind.Value, value: null };
            case "undefined":
              return { kind: ExpressionKind.Value, value: undefined };
          }
        })();

        const syntax = wrapSyntax(expr1, wrapSyntax(expr2, leaf.syntax));
        const expectedAst = wrapAst(expr1, wrapAst(expr2, leafAst));
        const expectedValue = wrapValue(expr1, wrapValue(expr2, leaf.value));
        out.push({
          id,
          expr1,
          expr2,
          expr3: leaf.name,
          syntax,
          expectedAst,
          expectedValue,
        });
        id += 1;
      }
    }
  }

  return out;
}

function buildCallCases(): CallCase[] {
  return leaves.map((leaf, i) => {
    const argAst: Expression = (() => {
      switch (leaf.name) {
        case "array":
          return { kind: ExpressionKind.Array, expressions: [] };
        case "object":
          return { kind: ExpressionKind.Object, keys: [] };
        case "number":
          return { kind: ExpressionKind.Number, value: 0 };
        case "string-literal":
          return { kind: ExpressionKind.String, values: ["text-value"] };
        case "reference":
          return { kind: ExpressionKind.Reference, name: "ref" };
        case "boolean":
          return { kind: ExpressionKind.Boolean, value: true };
        case "null":
          return { kind: ExpressionKind.Value, value: null };
        case "undefined":
          return { kind: ExpressionKind.Value, value: undefined };
      }
    })();

    return {
      id: i + 1,
      leaf: leaf.name,
      syntax: `(id ${leaf.syntax})`,
      expectedAst: {
        kind: ExpressionKind.Invocation,
        expression: {
          kind: ExpressionKind.Reference,
          name: "id",
        },
        args: [argAst],
      },
      expectedValue: leaf.value,
    };
  });
}

Deno.test("req:expressions-runtime-009 - Every valid 3-level syntax combination evaluates to the expected runtime value", async (t) => {
  const cases = buildCases();
  const callCases = buildCallCases();
  assertEquals(cases.length, 72);
  assertEquals(callCases.length, 8);

  const globals = new Map<string, unknown>([
    ...std,
    ["ref", { from: "reference" }],
    ["id", (v: unknown) => v],
    ["pack", (...values: unknown[]) => values],
    ["xs", [1, 2]],
    ["ys", [2, 3]],
    ["base", { enabled: true, a: 1 }],
    ["override", { name: 2 }],
    ["patch", { b: 2, a: 3 }],
  ]);

  await t.step("core combinatorial cases", async () => {
    await assertGrammarCases({
      parse: expressionGrammar,
      evaluate: exec,
      cases,
      options: { globals },
    });
    await assertGrammarCases({
      parse: expressionGrammar,
      evaluate: exec,
      cases: callCases,
      options: { globals },
    });
  });

  await t.step("spread S1: array spread with leading element", async () => {
    const m = await expressionGrammar("[0 ...xs]", { globals });
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      assertEquals(m.value, {
        kind: ExpressionKind.Array,
        expressions: [
          {
            kind: ExpressionKind.ArrayElement,
            expression: { kind: ExpressionKind.Number, value: 0 },
          },
          {
            kind: ExpressionKind.ArraySpread,
            expression: { kind: ExpressionKind.Reference, name: "xs" },
          },
        ],
      });
      const execValue = await exec(m.value, m);
      assertEquals(execValue, [0, 1, 2]);
    }
  });

  await t.step("spread S2: multiple array spreads", async () => {
    const m = await expressionGrammar("[...xs ...ys]", {
      globals: new Map<string, unknown>([
        ...globals,
        ["xs", [1]],
        ["ys", [2, 3]],
      ]),
    });
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      assertEquals(m.value, {
        kind: ExpressionKind.Array,
        expressions: [
          {
            kind: ExpressionKind.ArraySpread,
            expression: { kind: ExpressionKind.Reference, name: "xs" },
          },
          {
            kind: ExpressionKind.ArraySpread,
            expression: { kind: ExpressionKind.Reference, name: "ys" },
          },
        ],
      });
      const execValue = await exec(m.value, m);
      assertEquals(execValue, [1, 2, 3]);
    }
  });

  await t.step("spread S3: object spread then key", async () => {
    const m = await expressionGrammar("{...base, name: 1}", { globals });
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      assertEquals(m.value, {
        kind: ExpressionKind.Object,
        keys: [
          {
            kind: ExpressionKind.ObjectSpread,
            expression: { kind: ExpressionKind.Reference, name: "base" },
          },
          {
            kind: ExpressionKind.ObjectKey,
            name: "name",
            expression: { kind: ExpressionKind.Number, value: 1 },
          },
        ],
      });
      const execValue = await exec(m.value, m);
      assertEquals(execValue, { enabled: true, a: 1, name: 1 });
    }
  });

  await t.step("spread S4: key then object spread override", async () => {
    const m = await expressionGrammar("{name: 1, ...override}", { globals });
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      assertEquals(m.value, {
        kind: ExpressionKind.Object,
        keys: [
          {
            kind: ExpressionKind.ObjectKey,
            name: "name",
            expression: { kind: ExpressionKind.Number, value: 1 },
          },
          {
            kind: ExpressionKind.ObjectSpread,
            expression: { kind: ExpressionKind.Reference, name: "override" },
          },
        ],
      });
      const execValue = await exec(m.value, m);
      assertEquals(execValue, { name: 2 });
    }
  });

  await t.step("spread S5: object spread merge", async () => {
    const m = await expressionGrammar("{...base, ...patch}", { globals });
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      assertEquals(m.value, {
        kind: ExpressionKind.Object,
        keys: [
          {
            kind: ExpressionKind.ObjectSpread,
            expression: { kind: ExpressionKind.Reference, name: "base" },
          },
          {
            kind: ExpressionKind.ObjectSpread,
            expression: { kind: ExpressionKind.Reference, name: "patch" },
          },
        ],
      });
      const execValue = await exec(m.value, m);
      assertEquals(execValue, { enabled: true, a: 3, b: 2 });
    }
  });

  await t.step("spread S6: object spread merge with trailing key", async () => {
    const m = await expressionGrammar("{...base, ...patch, keep: true}", {
      globals,
    });
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      assertEquals(m.value, {
        kind: ExpressionKind.Object,
        keys: [
          {
            kind: ExpressionKind.ObjectSpread,
            expression: { kind: ExpressionKind.Reference, name: "base" },
          },
          {
            kind: ExpressionKind.ObjectSpread,
            expression: { kind: ExpressionKind.Reference, name: "patch" },
          },
          {
            kind: ExpressionKind.ObjectKey,
            name: "keep",
            expression: { kind: ExpressionKind.Boolean, value: true },
          },
        ],
      });
      const execValue = await exec(m.value, m);
      assertEquals(execValue, { enabled: true, a: 3, b: 2, keep: true });
    }
  });

  await t.step("spread S7: invocation argument spread", async () => {
    const m = await expressionGrammar("(coalesce x ...y)", {
      globals: new Map<string, unknown>([
        ...globals,
        ["x", null],
        ["y", [7]],
      ]),
    });
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      assertEquals(m.value, {
        kind: ExpressionKind.Invocation,
        expression: {
          kind: ExpressionKind.Reference,
          name: "coalesce",
        },
        args: [
          {
            kind: ExpressionKind.Reference,
            name: "x",
          },
          {
            kind: ExpressionKind.InvocationSpread,
            expression: {
              kind: ExpressionKind.Reference,
              name: "y",
            },
          },
        ],
      });

      const execValue = await exec(m.value, m);
      assertEquals(execValue, 7);
    }
  });

  await t.step(
    "spread S8: invocation argument spread can prepend fixed args",
    async () => {
      const m = await expressionGrammar("(pack 1 ...y)", {
        globals: new Map<string, unknown>([
          ...globals,
          ["y", [2, 3]],
        ]),
      });
      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind === MatchKind.Ok) {
        const execValue = await exec(m.value, m);
        assertEquals(execValue, [1, 2, 3]);
      }
    },
  );
});
