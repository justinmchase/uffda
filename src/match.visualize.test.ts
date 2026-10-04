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
    "an explanation of the rule that failed leads the summary",
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
      const match = fail(scope, resolve("R"), [fail(inner, pattern)]);
      const explained = await analyzeMatchFailure(match, {
        explain: (r) => r === rule ? "Write expected." : undefined,
      });
      assertEquals(explained?.explanation, "Write expected.");
      assertEquals(
        formatMatchFailureSummary(explained!),
        'Write expected.\nUnexpected "#"',
      );
      const plain = await analyzeMatchFailure(match);
      assertEquals(plain?.explanation, undefined);
      assertStringIncludes(
        formatMatchFailureSummary(plain!),
        'Unexpected "#"',
      );
    },
  );

  await t.step("reports the end of input once the stream is done", async () => {
    const start = Scope.From(Input.Iterable("a"));
    const end = start.withInput(await start.stream.next());
    const pattern = { kind: PatternKind.Equal, value: lit("b") } as const;
    const analysis = await analyzeMatchFailure(fail(end, pattern));
    assertEquals(analysis?.unexpected, "<end of input>");
  });

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
  // Positions before "a", "b" and "c" of "abc".
  const positions = async () => {
    const s0 = Scope.From(Input.Iterable("abc"));
    const s1 = s0.withInput(await s0.stream.next());
    const s2 = s1.withInput(await s1.stream.next());
    await s2.stream.next();
    return [s0, s1, s2] as const;
  };

  await t.step("the failure furthest into the source", async () => {
    const [s0, s1] = await positions();
    const match = fail(s0, then, [
      fail(s0, equal("z")),
      ok(s0, s1, equal("a"), "a"),
      fail(s1, equal("x")),
    ]);
    const analysis = await analyzeMatchFailure(match);
    assertEquals(analysis?.unexpected, '"b"');
    assertEquals(analysis?.pattern, 'equal "x"');
  });

  await t.step("over an absorbed failure at the same place", async () => {
    const [s0, s1] = await positions();
    const star = { kind: PatternKind.Quantifier } as unknown as Pattern;
    const match = fail(s0, then, [
      ok(s0, s1, equal("a"), "a"),
      ok(s1, s1, star, [], [fail(s1, equal("q"))]),
      fail(s0, then, [fail(s0, then, [fail(s1, equal("x"))])]),
    ]);
    const analysis = await analyzeMatchFailure(match);
    assertEquals(analysis?.pattern, 'equal "x"');
  });

  await t.step("never from inside a successful pipeline", async () => {
    const [s0, s1, s2] = await positions();
    const pipeline: PipelinePattern = {
      kind: PatternKind.Pipeline,
      steps: [equal("a")],
    };
    const match = fail(s0, then, [
      ok(s0, s1, pipeline, "a", [fail(s2, equal("y"))]),
      fail(s1, equal("x")),
    ]);
    const analysis = await analyzeMatchFailure(match);
    assertEquals(analysis?.pattern, 'equal "x"');
  });

  await t.step("never from inside a successful not", async () => {
    const [s0, s1, s2] = await positions();
    const not = { kind: PatternKind.Not, pattern: equal("b") } as const;
    const match = fail(s0, then, [
      ok(s0, s0, not, undefined, [fail(s2, equal("y"))]),
      fail(s1, equal("x")),
    ]);
    const analysis = await analyzeMatchFailure(match);
    assertEquals(analysis?.pattern, 'equal "x"');
  });

  await t.step(
    "explained only by a rule enclosing every tied failure",
    async () => {
      const [, s1] = await positions();
      const outer = rule("Outer", s1);
      const inner = rule("Inner", s1);
      const inOuter = s1.pushRule(outer, new Map());
      const inInner = inOuter.pushRule(inner, new Map());
      const match = fail(s1, resolve("Outer"), [
        fail(inOuter, then, [
          fail(inOuter, resolve("Inner"), [fail(inInner, equal("#"))]),
          fail(inOuter, equal(",")),
        ]),
      ]);
      const innerOnly = await analyzeMatchFailure(match, {
        explain: (r) => r === inner ? "inner" : undefined,
      });
      assertEquals(innerOnly?.explanation, undefined);
      const both = await analyzeMatchFailure(match, {
        explain: (r) => r === inner ? "inner" : r === outer ? "outer" : "",
      });
      assertEquals(both?.explanation, "outer");
    },
  );

  await t.step("not by a rule that began before the failure", async () => {
    const [s0, s1] = await positions();
    const outer = rule("Outer", s0);
    const match = fail(s0, resolve("Outer"), [
      fail(s0.pushRule(outer, new Map()).withInput(s1.stream), equal("x")),
    ]);
    const analysis = await analyzeMatchFailure(match, {
      explain: (r) => r === outer ? "outer" : undefined,
    });
    assertEquals(analysis?.pattern, 'equal "x"');
    assertEquals(analysis?.explanation, undefined);
  });
});
