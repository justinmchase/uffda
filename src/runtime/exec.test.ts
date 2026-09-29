import { assert, assertEquals, assertThrows } from "@std/assert";
import { ok } from "../match.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { Scope } from "./scope.ts";
import { exec } from "./exec.ts";
import { ExpressionKind } from "./expressions/expression.kind.ts";
import type { Expression } from "./expressions/expression.ts";
import { unwrap } from "../wrapped.ts";

Deno.test("runtime/exec", async (t) => {
  const scope = Scope.Default();
  const match = ok(scope, scope, { kind: PatternKind.Ok }, 7);

  await t.step("EXEC00 - immediate expressions evaluate synchronously", () => {
    assertEquals(
      unwrap(exec({ kind: ExpressionKind.Number, value: 1 }, match)),
      1,
    );
    assertEquals(
      unwrap(exec({ kind: ExpressionKind.Reference, name: "_" }, match)),
      7,
    );
  });

  await t.step(
    "EXEC01 - an awaitable child makes the result a promise",
    async () => {
      const result = exec(
        { kind: ExpressionKind.Native, fn: () => Promise.resolve(2) },
        match,
      );
      assert(result instanceof Promise);
      assertEquals(unwrap(await result), 2);
    },
  );

  await t.step("EXEC02 - an unknown expression kind throws", () => {
    assertThrows(
      () => exec({ kind: "unknown" } as unknown as Expression, match),
      Error,
      "Cannot exec unknown expression kind unknown",
    );
  });
});
