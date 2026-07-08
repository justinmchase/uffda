import { assertEquals, assertNotEquals, assertRejects } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { expressionGrammar } from "../../lang/expression/expression.lang.ts";
import { exec } from "../../runtime/exec.ts";

Deno.test("req:expression-language-syntax-010 - Expression syntax excludes statement-style branching/binding while retaining projection forms", async (t) => {
  await t.step("projection invocation remains supported", async () => {
    const m = await expressionGrammar("(add 1 2)");
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      const value = await exec(m.value, m);
      assertEquals(value, 3);
    }
  });

  await t.step(
    "statement-style if/else form is not accepted by expression syntax",
    async () => {
      const m = await expressionGrammar("if(x){x}else{y}");
      if (m.kind === MatchKind.Ok) {
        await assertRejects(async () => {
          await exec(m.value, m);
        });
      } else {
        assertNotEquals(m.kind, MatchKind.Ok);
      }
    },
  );

  await t.step(
    "statement-style let binding form is not accepted by expression syntax",
    async () => {
      const m = await expressionGrammar("let x = 1");
      if (m.kind === MatchKind.Ok) {
        await assertRejects(async () => {
          await exec(m.value, m);
        });
      } else {
        assertNotEquals(m.kind, MatchKind.Ok);
      }
    },
  );

  await t.step(
    "infix logical precedence form is not accepted in MVP expression syntax",
    async () => {
      const m = await expressionGrammar("x and y or z");
      if (m.kind === MatchKind.Ok) {
        await assertRejects(async () => {
          await exec(m.value, m);
        });
      } else {
        assertNotEquals(m.kind, MatchKind.Ok);
      }
    },
  );
});
