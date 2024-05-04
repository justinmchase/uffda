import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { ValueType } from "./pattern.ts";

Deno.test("runtime.patterns.type", async (t) => {
  const typeTests = [
    { input: BigInt("0001"), type: ValueType.BigInt, success: true },
    { input: true, type: ValueType.Boolean, success: true },
    { input: false, type: ValueType.Boolean, success: true },
    { input: () => {}, type: ValueType.Function, success: true },
    { input: 7, type: ValueType.Number, success: true },
    { input: {}, type: ValueType.Object, success: true },
    { input: "a", type: ValueType.String, success: true },
    { input: Symbol(), type: ValueType.Symbol, success: true },
    { input: undefined, type: ValueType.Undefined, success: true },

    {
      input: null,
      type: ValueType.BigInt,
      success: false,
    },
    {
      input: null,
      type: ValueType.Boolean,
      success: false,
    },
    {
      input: null,
      type: ValueType.Function,
      success: false,
    },
    {
      input: null,
      type: ValueType.Number,
      success: false,
    },
    {
      input: undefined,
      type: ValueType.Object,
      success: false,
    },
    {
      input: null,
      type: ValueType.String,
      success: false,
    },
    {
      input: null,
      type: ValueType.Symbol,
      success: false,
    },
    {
      input: null,
      type: ValueType.Undefined,
      success: false,
    },
  ];

  for (const { input, type, success } of typeTests) {
    await t.step({
      name: `${String(input)} is ${type}: ${success}`,
      fn: patternTest({
        pattern: { kind: PatternKind.Type, type },
        input: Input.From([input]),
        value: success ? input : undefined,
        kind: success ? MatchKind.Ok : MatchKind.Fail,
      }),
    });
  }
});
