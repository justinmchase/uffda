import { assertStringIncludes } from "@std/assert";
import { fail, ok, visualizeMatchFailure } from "./match.ts";
import { Scope } from "./runtime/scope.ts";
import { Input } from "./input.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import type { FailPattern, PipelinePattern } from "./runtime/patterns/mod.ts";

const testPattern: FailPattern = {
  kind: PatternKind.Fail,
};

const pipelinePattern: PipelinePattern = {
  kind: PatternKind.Pipeline,
  steps: [testPattern, testPattern],
};

Deno.test({
  name: "visualizeMatchFailure",
  fn: async (t) => {
    await t.step({
      name: "VIS_00 - visualizes a simple failure",
      fn: () => {
        const scope = Scope.From(Input.From("test"));
        const match = fail(scope, testPattern);

        const result = visualizeMatchFailure(match);

        assertStringIncludes(result, "Match Failure Visualization");
        assertStringIncludes(result, "Parse failed at position");
        assertStringIncludes(result, "Fail");
      },
    });

    await t.step({
      name: "VIS_01 - visualizes nested failures",
      fn: () => {
        const input = Input.From("test");
        const scope0 = Scope.From(input);
        const scope1 = scope0.withInput(input.next());

        const childMatch = fail(scope1, testPattern);
        const parentMatch = fail(scope0, testPattern, [childMatch]);

        const result = visualizeMatchFailure(parentMatch);

        assertStringIncludes(result, "Match Failure Visualization");
        assertStringIncludes(result, "✗");
        assertStringIncludes(result, "[0]");
      },
    });

    await t.step({
      name: "VIS_02 - visualizes pipeline failures",
      fn: () => {
        const input = Input.From("test");
        const scope0 = Scope.From(input);
        const scope1 = scope0.withInput(input.next());

        const step1 = ok(scope0, scope1, testPattern, "step1");
        const step2 = fail(scope1, testPattern);
        const pipelineMatch = fail(scope0, pipelinePattern, [step1, step2]);

        const result = visualizeMatchFailure(pipelineMatch);

        assertStringIncludes(result, "Pipeline");
        assertStringIncludes(result, "[step 0]");
        assertStringIncludes(result, "[step 1]");
        assertStringIncludes(result, "✓");
        assertStringIncludes(result, "✗");
      },
    });

    await t.step({
      name: "VIS_03 - shows rightmost failure marker",
      fn: () => {
        const input = Input.From("test");
        const scope0 = Scope.From(input);
        const scope1 = scope0.withInput(input.next());
        const scope2 = scope0.withInput(input.next().next());

        const child1 = fail(scope1, testPattern);
        const child2 = fail(scope2, testPattern);
        const parentMatch = fail(scope0, testPattern, [child1, child2]);

        const result = visualizeMatchFailure(parentMatch);

        assertStringIncludes(result, "👉");
        assertStringIncludes(result, "[2]");
      },
    });

    await t.step({
      name: "VIS_04 - includes input context",
      fn: () => {
        const input = Input.From("abc");
        const scope = Scope.From(input.next());
        const match = fail(scope, testPattern);

        const result = visualizeMatchFailure(match);

        assertStringIncludes(result, "Input Context");
        assertStringIncludes(result, "Position:");
      },
    });

    await t.step({
      name: "VIS_05 - handles successful matches with failures",
      fn: () => {
        const input = Input.From("test");
        const scope0 = Scope.From(input);
        const scope1 = scope0.withInput(input.next());

        const okMatch = ok(scope0, scope1, testPattern, "success");
        const failMatch = fail(scope1, testPattern);
        const parentMatch = fail(scope0, testPattern, [okMatch, failMatch]);

        const result = visualizeMatchFailure(parentMatch);

        assertStringIncludes(result, "✓");
        assertStringIncludes(result, "success");
        assertStringIncludes(result, "✗");
      },
    });
  },
});
