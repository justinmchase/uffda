import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
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
    fn: () => {
      const memos = new Memos();
      const ruleA = fakeRule("a");

      memos.withFrame(Path.From(0), () => {
        const { key } = memos.resolve(Path.From(0), ruleA, []);
        memos.set(Path.From(0), key, fakeMatch());

        assertThrows(
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

  await t.step({
    name: "MEMO08",
    // The low-water mark is the minimum start among all active frames, not
    // the outermost frame's start: a nested frame that starts earlier than
    // its ancestor (e.g. a stage over a different stream) lowers the mark
    // while it is active, and the ancestor's mark is restored once it pops.
    fn: () => {
      const memos = new Memos();
      const rule = fakeRule("r");
      const put = (p: number) => {
        const { key } = memos.resolve(Path.From(p), rule, []);
        memos.set(Path.From(p), key, fakeMatch());
        return key;
      };

      memos.withFrame(Path.From(5), () => {
        memos.withFrame(Path.From(2), () => {
          const key3 = put(3);
          memos.withFrame(Path.From(10), () => {
            put(10);
          });
          // Mark is 2 (the nested frame), so position 3 survives.
          assertEquals(memos.get(Path.From(3), key3).memo !== undefined, true);
          assertEquals(memos.size, 2);
        });
        // The frame at 2 popped: the mark is back to 5, evicting 3.
        assertEquals(memos.size, 1);
      });
      assertEquals(memos.size, 0);
    },
  });

  await t.step({
    name: "MEMO09",
    // Computing the low-water mark does not scale with how deeply frames
    // nest: path comparisons made while entering and leaving N nested frames
    // grow linearly in N, not quadratically.
    fn: () => {
      const comparisons = (depth: number) => {
        const memos = new Memos();
        const original = Path.prototype.compareTo;
        let count = 0;
        Path.prototype.compareTo = function (this: Path, other: Path) {
          count++;
          return original.call(this, other);
        };
        try {
          const enter = (i: number): void => {
            if (i < depth) {
              memos.withFrame(Path.From(i), () => enter(i + 1));
            }
          };
          enter(0);
        } finally {
          Path.prototype.compareTo = original;
        }
        return count;
      };

      const small = comparisons(500);
      const large = comparisons(2_000);
      assertEquals(large <= small * 4 + 8, true, `${small} -> ${large}`);
    },
  });

  await t.step({
    name: "MEMO_FRAME_ASYNC",
    // A frame whose fn rejects is still left, just like one that throws.
    fn: async () => {
      const memos = new Memos();
      const ruleA = fakeRule("a");
      await memos.withFrame(Path.From(0), async () => {
        const { key } = memos.resolve(Path.From(0), ruleA, []);
        memos.set(Path.From(0), key, fakeMatch());
        await assertRejects(
          async () =>
            await memos.withFrame(
              Path.From(1),
              () => Promise.reject(new Error("boom")),
            ),
          Error,
          "boom",
        );
        assertEquals(memos.size, 1);
      });
      assertEquals(memos.size, 0);
    },
  });

  await t.step({
    name: "MEMO_DELETE",
    // delete drops a single entry without disturbing others at its position.
    fn: () => {
      const memos = new Memos();
      const path = Path.From(0);
      const { key: keyA } = memos.resolve(path, fakeRule("a"), []);
      const { key: keyB } = memos.resolve(path, fakeRule("b"), []);
      memos.set(path, keyA, fakeMatch());
      memos.set(path, keyB, fakeMatch());
      memos.delete(path, keyA);
      assertEquals(memos.get(path, keyA).memo, undefined);
      assertEquals(memos.get(path, keyB).memo !== undefined, true);
    },
  });

  await t.step({
    name: "MEMO_SEED_OBSERVED",
    // Re-entering an in-progress entry makes every frame above it depend on
    // its seed; once the seed's iteration advances those outcomes are stale.
    fn: async () => {
      const memos = new Memos();
      const path = Path.From(0);
      const head = fakeRule("head");
      const involved = fakeRule("involved");
      const { key: headKey } = memos.resolve(path, head, []);
      const headMemo = memos.set(path, headKey, fakeMatch());
      await memos.withFrame(path, async () => {
        headMemo.iteration = 1;
        const { key } = memos.resolve(path, involved, []);
        const involvedMemo = memos.set(path, key, fakeMatch());
        await memos.withFrame(path, () => {
          assertStrictEquals(memos.resolve(path, head, []).memo, headMemo);
        }, involvedMemo);
        assertEquals(involvedMemo.seed, { memo: headMemo, iteration: 1 });
        assertStrictEquals(
          memos.resolve(path, involved, []).memo,
          involvedMemo,
        );

        headMemo.iteration = 2;
        assertEquals(memos.resolve(path, involved, []).memo, undefined);
      }, headMemo);
    },
  });

  await t.step({
    name: "MEMO_SEED_TRANSITIVE",
    // Reusing an entry computed against a live seed propagates that
    // dependency to the reusing frame, and an entry computed in a growth's
    // final iteration stays reusable after the growth completes.
    fn: async () => {
      const memos = new Memos();
      const path = Path.From(0);
      const [head, involved, reuser] = ["head", "involved", "reuser"].map(
        fakeRule,
      );
      const { key: headKey } = memos.resolve(path, head, []);
      const headMemo = memos.set(path, headKey, fakeMatch());
      const { key: involvedKey } = memos.resolve(path, involved, []);
      const involvedMemo = memos.set(path, involvedKey, fakeMatch());
      const { key: reuserKey } = memos.resolve(path, reuser, []);
      const reuserMemo = memos.set(path, reuserKey, fakeMatch());
      // An enclosing frame keeps the table from being cleared when the
      // head's own frame returns.
      await memos.withFrame(path, async () => {
        await memos.withFrame(path, async () => {
          involvedMemo.seed = { memo: headMemo, iteration: 0 };
          await memos.withFrame(path, () => {
            assertStrictEquals(
              memos.resolve(path, involved, []).memo,
              involvedMemo,
            );
          }, reuserMemo);
        }, headMemo);
        assertEquals(reuserMemo.seed, { memo: headMemo, iteration: 0 });
        assertStrictEquals(memos.resolve(path, reuser, []).memo, reuserMemo);
      });
    },
  });

  await t.step({
    name: "MEMO_SEED_NESTED",
    // A frame keeps its dependency on a more deeply nested in-progress entry
    // when it also observes an outer one; the nested entry's own chain
    // reaches the outer entry instead.
    fn: async () => {
      const memos = new Memos();
      const path = Path.From(0);
      const [outer, inner, frame] = ["outer", "inner", "frame"].map(fakeRule);
      const entry = (rule: Rule) =>
        memos.set(path, memos.resolve(path, rule, []).key, fakeMatch());
      const outerMemo = entry(outer);
      const innerMemo = entry(inner);
      const frameMemo = entry(frame);
      await memos.withFrame(path, async () => {
        await memos.withFrame(path, async () => {
          await memos.withFrame(path, () => {
            memos.resolve(path, inner, []);
            memos.resolve(path, outer, []);
          }, frameMemo);
        }, innerMemo);
      }, outerMemo);
      assertStrictEquals(frameMemo.seed?.memo, innerMemo);
      assertStrictEquals(innerMemo.seed?.memo, outerMemo);

      outerMemo.iteration++;
      assertEquals(memos.resolve(path, frame, []).memo, undefined);
    },
  });
});

Deno.test("memo recovery", async (t) => {
  await t.step({
    name: "MEMO_RECOVERY - keys are isolated by recovery setting",
    fn: () => {
      const memos = new Memos();
      const rule = fakeRule("a");
      const path = Path.From(0);
      const clean = memos.resolve(path, rule, []);
      const recovering = memos.resolve(path, rule, [], true);
      assertEquals(clean.key === recovering.key, false);
      memos.set(path, clean.key, fakeMatch());
      assertEquals(memos.resolve(path, rule, [], true).memo, undefined);
      assertEquals(memos.resolve(path, rule, [], true).key, recovering.key);
    },
  });

  await t.step({
    name: "MEMO_FAILED_SEED - a watch reports only enclosing failing seeds",
    fn: async () => {
      const memos = new Memos();
      const rule = fakeRule("a");
      const path = Path.From(0);
      const { key } = memos.resolve(path, rule, []);
      const head = memos.set(path, key, fakeMatch());
      head.match = { ...fakeMatch(), kind: "fail" } as unknown as Match;
      await memos.withFrame(path, () => {
        const depth = memos.depth;
        const outer = memos.watchFailedSeeds();
        memos.resolve(path, rule, []);
        assertEquals(memos.endFailedSeedWatch(outer, depth), true);

        const nested = memos.watchFailedSeeds();
        assertEquals(memos.endFailedSeedWatch(nested, 0), false);
        return undefined;
      }, head);
    },
  });

  await t.step({
    name: "MEMO_LAYER - a layer shares recoverable but no entries",
    fn: () => {
      const memos = new Memos();
      const rule = fakeRule("a");
      const path = Path.From(0);
      memos.set(path, memos.resolve(path, rule, []).key, fakeMatch());

      const layer = memos.layer();
      assertEquals(layer.resolve(path, rule, []).memo, undefined);
      assertEquals(layer.size, 0);

      layer.recoverable = true;
      assertEquals(memos.recoverable, true);
      memos.recoverable = false;
      assertEquals(layer.recoverable, false);
    },
  });
});
