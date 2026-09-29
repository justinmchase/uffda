import { assert, assertEquals, assertStrictEquals } from "@std/assert";
import {
  fail,
  forward,
  getRightmostFailure,
  isSuccess,
  MatchKind,
  ok,
  skip,
  valueOf,
} from "./match.ts";
import type { MatchOrigin } from "./match.ts";
import type { Rule } from "./runtime/modules/mod.ts";
import { Path } from "./path.ts";
import { Scope } from "./runtime/scope.ts";
import { match } from "./runtime/match.ts";
import { Input } from "./input.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import type { FailPattern } from "./runtime/patterns/mod.ts";
import { unwrap, Wrapped } from "./wrapped.ts";

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
        const scope = Scope.From(Input.Iterable("test"));
        const match = fail(scope, testPattern);

        const result = getRightmostFailure(match);

        assertEquals(result, match);
      },
    });

    await t.step({
      name:
        "RIGHTMOST01 - returns the rightmost child when it has a greater start position",
      fn: async () => {
        const input = Input.Iterable("test");
        const scope0 = Scope.From(input);
        const scope1 = scope0.withInput(await input.next());
        const scope2 = scope0.withInput(await (await input.next()).next());

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
      fn: async () => {
        const input = Input.Iterable("test");
        const scope0 = Scope.From(await (await input.next()).next());
        const scope1 = scope0.withInput(input);
        const scope2 = scope0.withInput(await input.next());

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
      fn: async () => {
        const input = Input.Iterable("test");
        const scope0 = Scope.From(input);
        const i1 = await input.next();
        const i2 = await i1.next();
        const i3 = await i2.next();
        const scope1 = scope0.withInput(i1);
        const scope2 = scope0.withInput(i2);
        const scope3 = scope0.withInput(i3);

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
      fn: async () => {
        const input = Input.Iterable("test");
        const scope0 = Scope.From(input);
        const scope1 = scope0.withInput(await input.next());

        const okMatch = ok(scope1, scope1, testPattern);
        const failMatch = fail(scope0, testPattern);
        const parentMatch = fail(scope0, testPattern, [okMatch, failMatch]);

        const result = getRightmostFailure(parentMatch);

        // Should return parent since the only child fail has the same position
        assertEquals(result, parentMatch);
      },
    });

    await t.step({
      name: "RIGHTMOST05 - handles complex tree with multiple branches",
      fn: async () => {
        const input = Input.Iterable("testing");
        const scope0 = Scope.From(input);
        const i1 = await input.next();
        const i2 = await i1.next();
        const i3 = await i2.next();
        const i4 = await i3.next();
        const scope1 = scope0.withInput(i1);
        const scope2 = scope0.withInput(i2);
        const scope3 = scope0.withInput(i3);
        const scope4 = scope0.withInput(i4);

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
        const scope = Scope.From(Input.Iterable("test"));
        const match = fail(scope, testPattern, []);

        const result = getRightmostFailure(match);

        assertEquals(result, match);
      },
    });

    await t.step({
      name: "RIGHTMOST07 - compares paths correctly with different segments",
      fn: async () => {
        const input = Input.Scalar({ a: "x", b: "y" });
        const scope0 = Scope.From(input);
        const scope1 = scope0.withInput(await input.next());

        const child1 = fail(scope0, testPattern);
        const child2 = fail(scope1, testPattern);
        const parent = fail(scope0, testPattern, [child1, child2]);

        const result = getRightmostFailure(parent);

        assertEquals(result, child2);
        assertEquals(result.span.start.compareTo(child1.span.start) > 0, true);
      },
    });

    await t.step({
      name: "RIGHTMOST08 - terminates on a cyclic match graph",
      fn: async () => {
        const input = Input.Iterable("ab");
        const scope0 = Scope.From(input);
        const scope1 = scope0.withInput(await input.next());

        const child = fail(scope1, testPattern);
        const parent = fail(scope0, testPattern, [child]);
        // Introduce a cycle: child points back at parent.
        (child as { matches: unknown[] }).matches.push(parent);

        const result = getRightmostFailure(parent);
        assertEquals(result, child);
      },
    });
  },
});

Deno.test({
  name: "match/source-spans",
  fn: async (t) => {
    await t.step({
      name: "OK match attaches identity source spans from stream offsets",
      fn: async () => {
        const scope = Scope.From(Input.Iterable("ab"));
        const result = await match({ kind: PatternKind.Any }, scope);
        assertEquals(result.kind, MatchKind.Ok);
        if (result.kind !== MatchKind.Ok) return;
        assertEquals(unwrap(result.value), "a");
        assertEquals(result.originalSpan, { start: 0, end: 1 });
      },
    });

    await t.step({
      name: "FAIL match attaches zero-width source spans at the current offset",
      fn: () => {
        const scope = Scope.From(Input.Iterable("ab"));
        const result = fail(scope, testPattern);
        assertEquals(result.originalSpan, { start: 0, end: 0 });
      },
    });

    await t.step({
      name: "OK match spans the origins of the items it consumed",
      fn: async () => {
        // "\n" normalized from "\r\n" at 1..3.
        const scope = Scope.From(Input.Iterable([
          new Wrapped("a", { start: 0, end: 1 }),
          new Wrapped("\n", { start: 1, end: 3 }),
          new Wrapped("b", { start: 3, end: 4 }),
        ]));
        const result = await match({
          kind: PatternKind.Then,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Any },
          ],
        }, scope);
        assertEquals(result.kind, MatchKind.Ok);
        if (result.kind !== MatchKind.Ok) return;
        assertEquals(result.originalSpan, { start: 0, end: 3 });
      },
    });
  },
});

Deno.test({
  name: "match/origin",
  fn: async (t) => {
    await t.step({
      name: "ORIGIN00 - Ok and Fail carry a seeded origin unchanged",
      fn: () => {
        const scope = Scope.From(Input.Iterable("a"));
        const origin: MatchOrigin = {
          rule: { name: "R" } as Rule,
          args: new Map(),
          seeded: true,
        };
        assertStrictEquals(
          ok(scope, scope, testPattern, undefined, [], origin).origin,
          origin,
        );
        assertStrictEquals(fail(scope, testPattern, [], origin).origin, origin);
      },
    });
  },
});

Deno.test("match/skip", async (t) => {
  const start = Scope.From(Input.Iterable("ab"));
  const end = start;

  await t.step("MATCH_SKIP00 - skip is a success with value undefined", () => {
    const m = skip(start, end, testPattern);
    assertEquals(m.kind, MatchKind.Skip);
    assert(isSuccess(m));
    assertEquals(valueOf(m), undefined);
  });

  await t.step("MATCH_SKIP01 - isSuccess rejects failures", () => {
    assert(!isSuccess(fail(start, testPattern)));
  });

  await t.step("MATCH_SKIP02 - forward keeps an ordinary child's value", () => {
    const child = ok(start, end, testPattern, "a");
    const m = forward(start, end, testPattern, child);
    assertEquals(m.kind, MatchKind.Ok);
    assertEquals(valueOf(m), "a");
    assertEquals(m.matches, [child]);
  });

  await t.step("MATCH_SKIP03 - forward skips over a skipped child", () => {
    const child = skip(start, end, testPattern);
    const m = forward(start, end, testPattern, child);
    assertEquals(m.kind, MatchKind.Skip);
    assertEquals(valueOf(m), undefined);
    assertEquals(m.matches, [child]);
  });

  await t.step(
    "MATCH_SKIP04 - getRightmostFailure looks inside skipped matches",
    async () => {
      const input = Input.Iterable("ab");
      const scope0 = Scope.From(input);
      const scope1 = scope0.withInput(await input.next());
      const failure = fail(scope1, testPattern);
      const skipped = skip(scope0, scope1, testPattern, [failure]);
      const parent = fail(scope0, testPattern, [skipped]);
      assertEquals(getRightmostFailure(parent), failure);
    },
  );
});
