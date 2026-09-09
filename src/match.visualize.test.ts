import { assertStringIncludes } from "@std/assert";
import { Input } from "./input.ts";
import { fail, MatchKind, ok } from "./match.ts";
import { visualizeMatchFailure } from "./match.visualize.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import { lit } from "./runtime/patterns/value_source.ts";
import type { PipelinePattern } from "./runtime/patterns/pattern.ts";
import { Scope } from "./runtime/scope.ts";

Deno.test("match.visualize renders pipeline failures and terminates on cycles", async (t) => {
  await t.step("renders expected input and prior pipeline output", () => {
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

    const visualization = visualizeMatchFailure(match);

    assertStringIncludes(visualization, "Outcome: fail");
    assertStringIncludes(visualization, 'Unexpected: "#"');
    assertStringIncludes(visualization, 'Expected: "expected"');
    assertStringIncludes(visualization, "[1] OK any");
    assertStringIncludes(visualization, 'output: "tokenized"');
    assertStringIncludes(visualization, '[2] FAIL equal "expected"');
    assertStringIncludes(visualization, scope.module.moduleUrl.href);
    assertStringIncludes(visualization, "Failure tree:");
  });

  await t.step("terminates on a cyclic match graph", () => {
    const scope = Scope.From(Input.Iterable("#"));
    const pattern = { kind: PatternKind.Fail } as const;
    const match = fail(scope, pattern);
    match.matches.push(match);

    const visualization = visualizeMatchFailure(match);

    assertStringIncludes(visualization, "Match failure");
    assertStringIncludes(visualization, "[shared or cyclic match #1]");
    assertStringIncludes(visualization, MatchKind.Fail.toUpperCase());
  });
});
