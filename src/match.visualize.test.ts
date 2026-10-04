import { assertEquals, assertStringIncludes } from "@std/assert";
import { Input } from "./input.ts";
import { fail, MatchKind, ok } from "./match.ts";
import {
  analyzeMatchFailure,
  formatMatchFailureSummary,
  visualizeMatchFailure,
} from "./match.visualize.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import { lit } from "./runtime/patterns/value_source.ts";
import type { PipelinePattern } from "./runtime/patterns/pattern.ts";
import type { Rule } from "./runtime/modules/rule.ts";
import { Scope } from "./runtime/scope.ts";

Deno.test("match.visualize renders pipeline failures and terminates on cycles", async (t) => {
  await t.step("renders expected input and prior pipeline output", async () => {
    const scope = Scope.From(Input.Iterable("#"));
    const first = { kind: PatternKind.Any } as const;
    const second = { kind: PatternKind.Equal, value: lit("expected") } as const;
    const pipeline: PipelinePattern = {
      kind: PatternKind.Pipeline,
      steps: [first, second],
    };
    const firstMatch = ok(scope, scope, first, "tokenized");
    const secondMatch = fail(scope, second);
    const pipelineMatch = fail(scope, second, [firstMatch, secondMatch]);
    const match = fail(scope, pipeline, [pipelineMatch]);

    const visualization = await visualizeMatchFailure(match);

    assertStringIncludes(visualization, "Outcome: fail");
    assertStringIncludes(visualization, 'Unexpected: "#"');
    assertStringIncludes(visualization, 'Expected: "expected"');
    assertStringIncludes(visualization, "[1] OK any");
    assertStringIncludes(visualization, 'output: "tokenized"');
    assertStringIncludes(visualization, '[2] FAIL equal "expected"');
    assertStringIncludes(visualization, scope.module.moduleUrl.href);
    assertStringIncludes(visualization, "Failure tree:");
    assertEquals(visualization.includes("Wrapped"), false);
  });

  await t.step(
    "summarizeMatchFailure shares Unexpected/Expected with the visualizer",
    async () => {
      const scope = Scope.From(Input.Iterable("#"));
      const pattern = {
        kind: PatternKind.Equal,
        value: lit("expected"),
      } as const;
      const match = fail(scope, pattern);
      const analysis = await analyzeMatchFailure(match);
      assertEquals(analysis?.unexpected, '"#"');
      assertEquals(analysis?.expected, ['"expected"']);
      assertStringIncludes(
        formatMatchFailureSummary(analysis!),
        'Expected "expected"',
      );
      assertStringIncludes(formatMatchFailureSummary(analysis!), "Unexpected");
    },
  );

  await t.step(
    "an explanation of the innermost rule leads the summary",
    async () => {
      const scope = Scope.From(Input.Iterable("#"));
      const pattern = {
        kind: PatternKind.Equal,
        value: lit("expected"),
      } as const;
      const rule: Rule = {
        name: "R",
        module: scope.module,
        pattern,
        parameters: [],
      };
      const inner = scope.pushRule(rule, new Map());
      const match = fail(inner, pattern);
      const explained = await analyzeMatchFailure(match, {
        explain: (r) => r === rule ? "Write expected." : undefined,
      });
      assertEquals(explained?.explanation, "Write expected.");
      assertEquals(
        formatMatchFailureSummary(explained!),
        'Write expected.\nExpected "expected"\nUnexpected "#"\nIn R',
      );
      const plain = await analyzeMatchFailure(match);
      assertEquals(plain?.explanation, undefined);
      assertEquals(
        formatMatchFailureSummary(plain!),
        'Expected "expected"\nUnexpected "#"\nIn R',
      );
    },
  );

  await t.step("terminates on a cyclic match graph", async () => {
    const scope = Scope.From(Input.Iterable("#"));
    const pattern = { kind: PatternKind.Fail } as const;
    const match = fail(scope, pattern);
    match.matches.push(match);

    const visualization = await visualizeMatchFailure(match);

    assertStringIncludes(visualization, "Match failure");
    assertStringIncludes(visualization, "[shared or cyclic match #1]");
    assertStringIncludes(visualization, MatchKind.Fail.toUpperCase());
  });
});
