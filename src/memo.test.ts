import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import { Memos } from "./memo.ts";
import { Path } from "./path.ts";
import type { Match } from "./match.ts";
import type { Rule } from "./runtime/modules/rule.ts";

// A memoized `Match` is only ever inspected for identity in this suite; its
// shape is irrelevant to `Memos`, so a bare object stands in for one.
function fakeMatch(): Match {
  return {} as Match;
}

// `Memos` only ever uses a `Rule` as a WeakMap key, so identity is all that
// matters here too.
function fakeRule(name: string): Rule {
  return { name } as Rule;
}

Deno.test("memo.Memos", async (t) => {
  await t.step({
    name: "MEMO00",
    // resolve/set/get round-trip a memo entry for a given rule and position.
    fn: () => {
      const memos = new Memos();
      const ruleA = fakeRule("a");
      const path = Path.From(0);

      const first = memos.resolve(path, ruleA, []);
      assertEquals(first.memo, undefined);

      const match = fakeMatch();
      const stored = memos.set(path, first.key, match);
      assertStrictEquals(stored.match, match);

      const second = memos.resolve(path, ruleA, []);
      assertEquals(second.key, first.key);
      assertStrictEquals(second.memo?.match, match);
    },
  });

  await t.step({
    name: "MEMO01",
    // Distinct rules (and distinct argument rules) at the same position
    // resolve to distinct keys, so their memo entries do not collide.
    fn: () => {
      const memos = new Memos();
      const ruleA = fakeRule("a");
      const ruleB = fakeRule("b");
      const argA = fakeRule("argA");
      const argB = fakeRule("argB");
      const path = Path.From(0);

      const { key: keyA } = memos.resolve(path, ruleA, []);
      const { key: keyB } = memos.resolve(path, ruleB, []);
      const { key: keyAargA } = memos.resolve(path, ruleA, [argA]);
      const { key: keyAargB } = memos.resolve(path, ruleA, [argB]);

      assertEquals(keyA === keyB, false);
      assertEquals(keyA === keyAargA, false);
      assertEquals(keyAargA === keyAargB, false);

      // Resolving the same rule/args pair again is stable.
      const { key: keyAagain } = memos.resolve(path, ruleA, []);
      assertEquals(keyAagain, keyA);
    },
  });

  await t.step({
    name: "MEMO02",
    // get() looks up an entry by an already-resolved key without recomputing
    // it, mirroring how a memo hit is checked without re-deriving identity.
    fn: () => {
      const memos = new Memos();
      const ruleA = fakeRule("a");
      const path = Path.From(3);

      const { key } = memos.resolve(path, ruleA, []);
      assertEquals(memos.get(path, key).memo, undefined);

      const match = fakeMatch();
      memos.set(path, key, match);
      assertStrictEquals(memos.get(path, key).memo?.match, match);
    },
  });

  await t.step({
    name: "MEMO03",
    // Once the outermost rule frame completes (the active stack empties),
    // every memo entry is evicted: nothing further can ever revisit them.
    fn: async () => {
      const memos = new Memos();
      const ruleA = fakeRule("a");

      // deno-lint-ignore require-await
      await memos.withFrame(Path.From(0), async () => {
        const { key } = memos.resolve(Path.From(0), ruleA, []);
        memos.set(Path.From(0), key, fakeMatch());
        assertEquals(memos.size, 1);
      });

      assertEquals(memos.size, 0);
    },
  });

  await t.step({
    name: "MEMO04",
    // While an ancestor frame remains active, entries at or after its start
    // position survive a descendant frame's completion.
    fn: async () => {
      const memos = new Memos();
      const ruleA = fakeRule("a");
      const ruleB = fakeRule("b");
      const pathA = Path.From(5);
      const pathB = Path.From(10);

      await memos.withFrame(pathA, async () => {
        const { key: keyA } = memos.resolve(pathA, ruleA, []);
        memos.set(pathA, keyA, fakeMatch());

        // deno-lint-ignore require-await
        await memos.withFrame(pathB, async () => {
          const { key: keyB } = memos.resolve(pathB, ruleB, []);
          memos.set(pathB, keyB, fakeMatch());
          assertEquals(memos.size, 2);
        });

        // The inner frame popped, but the outer frame (started at 5) is
        // still active, so nothing at or after position 5 was evicted.
        assertEquals(memos.size, 2);
        assertStrictEquals(
          memos.get(pathA, keyA).memo?.match !== undefined,
          true,
        );
      });

      assertEquals(memos.size, 0);
    },
  });

  await t.step({
    name: "MEMO05",
    // Entries strictly before the low-water mark ARE evicted once the frame
    // that could still have depended on them pops, even while an ancestor
    // frame remains active.
    fn: async () => {
      const memos = new Memos();
      const ruleA = fakeRule("a");
      const ruleB = fakeRule("b");
      const pathOuter = Path.From(5);
      const pathStale = Path.From(2);
      const pathInner = Path.From(10);

      await memos.withFrame(pathOuter, async () => {
        // Position 2 is strictly before the active ancestor's own start of
        // 5. In real evaluation this never happens (positions only move
        // forward), but it directly exercises the eviction boundary.
        const { key: keyA } = memos.resolve(pathStale, ruleA, []);
        memos.set(pathStale, keyA, fakeMatch());
        assertEquals(memos.size, 1);

        // deno-lint-ignore require-await
        await memos.withFrame(pathInner, async () => {
          const { key: keyB } = memos.resolve(pathInner, ruleB, []);
          memos.set(pathInner, keyB, fakeMatch());
        });

        // The inner frame (position 10) popped; the low-water mark is now
        // the outer frame's own start (5). Position 2 is strictly before
        // that mark and is provably unreachable, so it was evicted, while
        // position 10 survives (it is at/after the mark).
        assertEquals(memos.size, 1);
        assertEquals(memos.get(pathStale, keyA).memo, undefined);
      });

      assertEquals(memos.size, 0);
    },
  });

  await t.step({
    name: "MEMO06",
    // Repeated, non-overlapping top-level parses never accumulate memo
    // entries across invocations: each one fully clears when it completes,
    // bounding working memory for a sequence of independent parses.
    fn: async () => {
      const memos = new Memos();
      const rule = fakeRule("r");

      for (let i = 0; i < 1_000; i++) {
        // deno-lint-ignore require-await
        await memos.withFrame(Path.From(0), async () => {
          for (let p = 0; p < 50; p++) {
            const { key } = memos.resolve(Path.From(p), rule, []);
            memos.set(Path.From(p), key, fakeMatch());
          }
        });
        assertEquals(memos.size, 0);
      }
    },
  });

  await t.step({
    name: "MEMO07",
    // withFrame still pops its frame and runs eviction when fn throws, so a
    // failed rule attempt does not leak an active frame that would pin the
    // low-water mark forever.
    fn: async () => {
      const memos = new Memos();
      const ruleA = fakeRule("a");

      await memos.withFrame(Path.From(0), async () => {
        const { key } = memos.resolve(Path.From(0), ruleA, []);
        memos.set(Path.From(0), key, fakeMatch());

        await assertRejects(
          () =>
            memos.withFrame(Path.From(1), () => {
              throw new Error("boom");
            }),
          Error,
          "boom",
        );

        // The failed inner frame still popped; the outer frame (position 0)
        // remains active, so its own entry survives.
        assertEquals(memos.size, 1);
      });

      assertEquals(memos.size, 0);
    },
  });
});
