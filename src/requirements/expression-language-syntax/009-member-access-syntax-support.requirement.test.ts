import { assertEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { expressionGrammar } from "../../lang/expression/expression.lang.ts";
import { exec } from "../../runtime/exec.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";

Deno.test("req:expression-language-syntax-009 - Expression syntax supports explicit member access and unary not forms", async (t) => {
  await t.step(
    "member access parses to member AST and evaluates deterministically",
    async () => {
      const m = await expressionGrammar("user.name", {
        globals: new Map([
          ["user", { name: "uffda" }],
        ]),
      });

      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind === MatchKind.Ok) {
        assertEquals(m.value, {
          kind: ExpressionKind.Member,
          expression: {
            kind: ExpressionKind.Reference,
            name: "user",
          },
          name: "name",
        });

        const value = await exec(m.value, m);
        assertEquals(value, "uffda");
      }
    },
  );

  await t.step("member chaining remains deterministic", async () => {
    const m = await expressionGrammar("user.profile.name", {
      globals: new Map([
        ["user", { profile: { name: "uffda" } }],
      ]),
    });

    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      const value = await exec(m.value, m);
      assertEquals(value, "uffda");
    }
  });

  await t.step("unary not parses to a canonical not AST", async () => {
    const m = await expressionGrammar("not true");

    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      assertEquals(m.value, {
        kind: ExpressionKind.Not,
        expression: {
          kind: ExpressionKind.Boolean,
          value: true,
        },
      });

      const value = await exec(m.value, m);
      assertEquals(value, false);
    }
  });
});
