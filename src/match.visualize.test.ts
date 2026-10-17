import { assertEquals, assertStringIncludes } from "@std/assert";
import { Input } from "./input.ts";
import { fail, MatchKind, ok } from "./match.ts";
import {
  analyzeMatchFailure,
  visualizeMatchFailure,
} from "./match.visualize.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import { lit } from "./runtime/patterns/value_source.ts";
import type { Pattern, PipelinePattern } from "./runtime/patterns/pattern.ts";
import type { Rule } from "./runtime/modules/rule.ts";
import { Scope } from "./runtime/scope.ts";
import { ResolveTargetKind } from "./runtime/patterns/pattern.ts";

const resolve = (name: string): Pattern => ({
  kind: PatternKind.Resolve,
  targetKind: ResolveTargetKind.Reference,
  name,
  args: [],
});

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
    const pipelineMatch = fail(scope, pipeline, [firstMatch, secondMatch]);
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
    "renders a pipeline that fails before its last step",
    async () => {
      const scope = Scope.From(Input.Iterable("#"));
      const first = { kind: PatternKind.Equal, value: lit("a") } as const;
      const pipeline: PipelinePattern = {
        kind: PatternKind.Pipeline,
        steps: [first, { kind: PatternKind.Any }],
      };
      const match = fail(scope, pipeline, [fail(scope, first)]);

      const visualization = await visualizeMatchFailure(match);

      assertStringIncludes(visualization, '[1] FAIL equal "a"');
      assertEquals(visualization.includes("[2]"), false);
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

Deno.test("match.visualize chooses the reported failure", async (t) => {
  const equal = (value: string) =>
    ({ kind: PatternKind.Equal, value: lit(value) }) as const;
  const then: Pattern = { kind: PatternKind.Then, patterns: [] };
  const rule = (name: string, scope: Scope): Rule => ({
    name,
    module: scope.module,
    pattern: then,
    parameters: [],
  });
  const positions = async () => {
    const s0 = Scope.From(Input.Iterable("abc"));
    const s1 = s0.withInput(await s0.stream.next());
    const s2 = s1.withInput(await s1.stream.next());
    await s2.stream.next();
    return [s0, s1, s2] as const;
  };

  await t.step("not a failure that only reads a failing seed", async () => {
    const [s0, s1, s2] = await positions();
    const head = rule("Head", s2);
    const match = fail(s0, then, [
      ok(s0, s1, equal("a"), "a"),
      fail(s1, equal("x")),
      fail(s2, resolve("Head"), [
        fail(s2, then, [], { rule: head, args: new Map(), seeded: true }),
      ]),
    ]);
    const analysis = await analyzeMatchFailure(match);
    assertEquals(analysis?.pattern, 'equal "x"');
  });
});
