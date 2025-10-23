import { assertEquals } from "@std/assert";
import { fail, getRightmostFailure, MatchKind, type MatchOk } from "./match.ts";
import { Path } from "./path.ts";
import { Scope } from "./runtime/scope.ts";
import { Input } from "./input.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import type { FailPattern } from "./runtime/patterns/mod.ts";

// Helper to create a simple test pattern
const testPattern: FailPattern = {
  kind: PatternKind.Fail,
};

Deno.test({
  name: "match/getRightmostFailure",
  fn: async (t) => {
    await t.step({
      name: "RIGHTMOST00 - returns the same match when there are no children",
      fn: () => {
        const scope = Scope.From(Input.From("test"));
        const match = fail(scope, testPattern);

        const result = getRightmostFailure(match);

        assertEquals(result, match);
      },
    });

    await t.step({
      name:
        "RIGHTMOST01 - returns the rightmost child when it has a greater start position",
      fn: () => {
        const input = Input.From("test");
        const scope0 = Scope.From(input);
        const scope1 = scope0.withInput(input.next());
        const scope2 = scope0.withInput(input.next().next());

        const childMatch1 = fail(scope1, testPattern);
        const childMatch2 = fail(scope2, testPattern);
        const parentMatch = fail(scope0, testPattern, [
          childMatch1,
          childMatch2,
        ]);

        const result = getRightmostFailure(parentMatch);

        assertEquals(result, childMatch2);
        assertEquals(result.span.start, Path.From(2));
      },
    });

    await t.step({
      name:
        "RIGHTMOST02 - returns parent when all children have smaller start positions",
      fn: () => {
        const input = Input.From("test");
        const scope0 = Scope.From(input.next().next());
        const scope1 = scope0.withInput(input);
        const scope2 = scope0.withInput(input.next());

        const childMatch1 = fail(scope1, testPattern);
        const childMatch2 = fail(scope2, testPattern);
        const parentMatch = fail(scope0, testPattern, [
          childMatch1,
          childMatch2,
        ]);

        const result = getRightmostFailure(parentMatch);

        assertEquals(result, parentMatch);
        assertEquals(result.span.start, Path.From(2));
      },
    });

    await t.step({
      name: "RIGHTMOST03 - recursively finds rightmost in nested failures",
      fn: () => {
        const input = Input.From("test");
        const scope0 = Scope.From(input);
        const scope1 = scope0.withInput(input.next());
        const scope2 = scope0.withInput(input.next().next());
        const scope3 = scope0.withInput(input.next().next().next());

        const deepestMatch = fail(scope3, testPattern);
        const middleMatch = fail(scope2, testPattern, [deepestMatch]);
        const childMatch = fail(scope1, testPattern, [middleMatch]);
        const parentMatch = fail(scope0, testPattern, [childMatch]);

        const result = getRightmostFailure(parentMatch);

        assertEquals(result, deepestMatch);
        assertEquals(result.span.start, Path.From(3));
      },
    });

    await t.step({
      name: "RIGHTMOST04 - ignores non-fail matches",
      fn: () => {
        const input = Input.From("test");
        const scope0 = Scope.From(input);
        const scope1 = scope0.withInput(input.next());

        const okMatch: MatchOk = {
          kind: MatchKind.Ok,
          pattern: testPattern,
          scope: scope1,
          span: { start: Path.From(1), end: Path.From(1) },
          matches: [],
          value: undefined,
        };
        const failMatch = fail(scope0, testPattern);
        const parentMatch = fail(scope0, testPattern, [okMatch, failMatch]);

        const result = getRightmostFailure(parentMatch);

        // Should return parent since the only child fail has the same position
        assertEquals(result, parentMatch);
      },
    });

    await t.step({
      name: "RIGHTMOST05 - handles complex tree with multiple branches",
      fn: () => {
        const input = Input.From("testing");
        const scope0 = Scope.From(input);
        const scope1 = scope0.withInput(input.next());
        const scope2 = scope0.withInput(input.next().next());
        const scope3 = scope0.withInput(input.next().next().next());
        const scope4 = scope0.withInput(input.next().next().next().next());

        // Left branch: 0 -> 1 -> 2
        const leftDeep = fail(scope2, testPattern);
        const leftMid = fail(scope1, testPattern, [leftDeep]);

        // Right branch: 0 -> 3 -> 4
        const rightDeep = fail(scope4, testPattern);
        const rightMid = fail(scope3, testPattern, [rightDeep]);

        const root = fail(scope0, testPattern, [leftMid, rightMid]);

        const result = getRightmostFailure(root);

        // Should find the rightmost which is at position 4
        assertEquals(result, rightDeep);
        assertEquals(result.span.start, Path.From(4));
      },
    });

    await t.step({
      name: "RIGHTMOST06 - handles match with empty children array",
      fn: () => {
        const scope = Scope.From(Input.From("test"));
        const match = fail(scope, testPattern, []);

        const result = getRightmostFailure(match);

        assertEquals(result, match);
      },
    });

    await t.step({
      name: "RIGHTMOST07 - compares paths correctly with different segments",
      fn: () => {
        const input = Input.From({ a: "x", b: "y" });
        const scope0 = Scope.From(input);
        const scope1 = scope0.withInput(input.next());

        const child1 = fail(scope0, testPattern);
        const child2 = fail(scope1, testPattern);
        const parent = fail(scope0, testPattern, [child1, child2]);

        const result = getRightmostFailure(parent);

        assertEquals(result, child2);
        assertEquals(result.span.start.compareTo(child1.span.start) > 0, true);
      },
    });
  },
});
