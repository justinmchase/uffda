import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { Input } from "../input.ts";
import type { Rule } from "../runtime/modules/rule.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import { Scope } from "../runtime/scope.ts";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import { diagnoseRecoveries, explainRule } from "./diagnostics.ts";

Deno.test("cli.diagnostics explainRule", async (t) => {
  const { module } = Scope.From(Input.Iterable([]));
  const rule = (metadata?: Record<string, unknown>): Rule => ({
    name: "R",
    module,
    pattern: { kind: PatternKind.Any } as const,
    parameters: [],
    ...(metadata ? { metadata } : {}),
  });

  await t.step("reads the rule's [Documentation] error", () => {
    assertEquals(
      explainRule(rule({ Documentation: { description: "d", error: "e" } })),
      "e",
    );
  });

  await t.step("has nothing to say without an error", () => {
    assertEquals(
      explainRule(rule({ Documentation: { description: "d" } })),
      undefined,
    );
    assertEquals(explainRule(rule()), undefined);
  });
});

Deno.test("cli.diagnostics diagnoseRecoveries", async (t) => {
  await t.step(
    "explains a comment after code inside a declaration",
    async () => {
      const source = "rule A =\n  |> B # ok?\n  |> C\n;";
      const [diagnostic, ...rest] = await diagnoseRecoveries(
        await uffdaGrammar(source),
      );
      assertEquals(rest, []);
      assert(diagnostic);
      assertEquals(
        source.slice(diagnostic.span.start, diagnostic.span.end),
        "# ok?",
      );
      assertStringIncludes(
        diagnostic.message.split("\n")[0],
        "a comment must be on a line of its own",
      );
    },
  );

  await t.step("explains other errors by their own rules", async () => {
    const [diagnostic] = await diagnoseRecoveries(
      await uffdaGrammar("rule A = ) ;\nrule B = b;"),
    );
    assert(diagnostic);
    assertStringIncludes(
      diagnostic.analysis?.explanation ?? "",
      "Expected a pattern here",
    );
  });

  await t.step("leaves errors no rule documents unexplained", async () => {
    const [diagnostic] = await diagnoseRecoveries(
      await uffdaGrammar("rule A = not;"),
    );
    assert(diagnostic);
    assertEquals(diagnostic.analysis?.explanation, undefined);
  });
});
