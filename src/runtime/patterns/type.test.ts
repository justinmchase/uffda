import { Type } from "@justinmchase/type";
import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

Deno.test("runtime.patterns.type", async (t) => {
  const typeTests = [
    { input: BigInt("0001"), type: Type.BigInt, success: true },
    { input: true, type: Type.Boolean, success: true },
    { input: false, type: Type.Boolean, success: true },
    { input: () => {}, type: Type.Function, success: true },
    { input: 7, type: Type.Number, success: true },
    { input: 7.11, type: Type.Number, success: true },
    { input: NaN, type: Type.Number, success: true },
    { input: {}, type: Type.Object, success: true },
    { input: "a", type: Type.String, success: true },
    { input: Symbol(), type: Type.Symbol, success: true },
    { input: undefined, type: Type.Undefined, success: true },
    { input: null, type: Type.Null, success: true },
    { input: new Map(), type: Type.Map, success: true },
    { input: new Set(), type: Type.Set, success: true },
    { input: new Date(), type: Type.Date, success: true },
    { input: new Error(), type: Type.Error, success: true },

    {
      input: null,
      type: Type.BigInt,
      success: false,
    },
    {
      input: null,
      type: Type.Boolean,
      success: false,
    },
    {
      input: null,
      type: Type.Function,
      success: false,
    },
    {
      input: null,
      type: Type.Number,
      success: false,
    },
    {
      input: undefined,
      type: Type.Object,
      success: false,
    },
    {
      input: null,
      type: Type.String,
      success: false,
    },
    {
      input: null,
      type: Type.Symbol,
      success: false,
    },
    {
      input: null,
      type: Type.Undefined,
      success: false,
    },
    { input: undefined, type: Type.Null, success: false },
    { input: null, type: Type.Map, success: false },
    { input: null, type: Type.Set, success: false },
    { input: null, type: Type.Date, success: false },
    { input: null, type: Type.Error, success: false },
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
