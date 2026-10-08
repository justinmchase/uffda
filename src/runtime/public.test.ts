import { assert, assertEquals } from "@std/assert";
import { isClean, valueOf } from "../match.ts";
import {
  evaluateExpression,
  ExpressionKind,
  InputNormalizationMode,
  match,
  PatternKind,
  Scope,
} from "./public.ts";
import type { Expression, Pattern } from "./public.ts";

Deno.test(
  "req:cli-distribution-007 - public runtime executes typed patterns",
  async () => {
    const pattern: Pattern = { kind: PatternKind.Any };
    const result = await match(
      pattern,
      Scope.From(["token"], { kind: InputNormalizationMode.Iterable }),
    );
    assert(isClean(result));
    assertEquals(valueOf(result), "token");
  },
);

Deno.test(
  "req:cli-distribution-007 - public expression evaluator resolves input and variables",
  async () => {
    const inputExpression: Expression = {
      kind: ExpressionKind.Reference,
      name: "_",
    };
    const stateExpression: Expression = {
      kind: ExpressionKind.Reference,
      name: "state",
    };
    assertEquals(
      await evaluateExpression(inputExpression, { input: "event" }),
      "event",
    );
    assertEquals(
      await evaluateExpression(stateExpression, {
        variables: { state: { count: 3 } },
      }),
      { count: 3 },
    );
  },
);
