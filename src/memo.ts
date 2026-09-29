import { RedBlackTree } from "@std/data-structures";
import type { Path } from "./path.ts";
import type { Match } from "./match.ts";
import type { Rule } from "./runtime/modules/mod.ts";
import { type Awaitable, ensure } from "./runtime/awaitable.ts";

export type Memo = {
  match: Match;
  /**
   * This entry's index on the active-frame stack while its own rule
   * invocation is in progress (see {@link Memos.withFrame}), otherwise
   * `undefined`. Re-entering an in-progress entry is left recursion.
   */
  frame?: number;
  /** How many left-recursive growth iterations this entry has started. */
  iteration: number;
  /**
   * The innermost in-progress entry whose left-recursive seed this entry's
   * outcome observed, and that entry's iteration at the time; see
   * `.agents/specifications/runtime/left-recursion.spec.md`.
   */
  seed?: Seed;
};

type Seed = { memo: Memo; iteration: number };

type Frame = { mark: Path; memo?: Memo };

type RecursiveWeakMap = WeakMap<Rule, { key: symbol; keys: RecursiveWeakMap }>;

/**
 * Whether `memo` was computed against a left-recursive seed that a later
 * growth iteration has since replaced, anywhere along its dependency chain.
 */
function isStale(memo: Memo): boolean {
  for (let seed = memo.seed; seed; seed = seed.memo.seed) {
    if (seed.iteration !== seed.memo.iteration) return true;
  }
  return false;
}

/** The innermost still in-progress entry along `memo`'s dependency chain. */
function liveSeed(memo: Memo): Memo | undefined {
  for (let seed = memo.seed; seed; seed = seed.memo.seed) {
    if (seed.memo.frame !== undefined) return seed.memo;
  }
  return undefined;
}

/**
 * Packrat memo table with proof-driven eviction (see
 * `.agents/specifications/runtime/memo-eviction.spec.md`).
 *
 * Storage uses a plain `Map`, not a `WeakMap`, because eviction is explicit
 * and active: entries are reclaimed the moment they are provably unreachable
 * (see {@link withFrame}), not merely whenever the garbage collector happens
 * to notice a `Path` is no longer referenced elsewhere. This also lets the
 * memo table be iterated, which a `WeakMap` deliberately does not support.
 *
 * Eviction only ever deletes this table's own reference to a memoized
 * `Match`. If that `Match` is also reachable some other way — for example, as
 * part of the parse's eventual delivered result, whose nested `matches`
 * arrays retain whichever child matches ended up on the accepted parse path —
 * it remains alive via ordinary JavaScript reachability regardless of
 * eviction. No separate "durable cache" of delivered-result entries is
 * needed: eviction only ever removes entries the delivered result does not
 * reference.
 */
export class Memos {
  private readonly keys: RecursiveWeakMap = new WeakMap();
  /**
   * Keyed by `path.toString()` rather than by `Path` object identity.
   * `Path` has value-based equality (`compareTo`) but no value-based `Map`
   * key semantics, and incremental re-parsing rehydrates entries against a
   * freshly-built `Path`/`Input` chain over a post-edit sequence — those
   * fresh `Path` objects are never reference-equal to the ones a prior parse
   * produced, even at numerically identical positions. Keying by the
   * deterministic string form lets structurally-equal positions from two
   * different parses hit the same entry.
   */
  private readonly memos = new Map<
    string,
    { path: Path; entries: Map<symbol, Memo> }
  >();

  /**
   * A second index over the same entries, keyed by position instead of by
   * `pathKey`, so eviction can find "everything before the low-water mark"
   * directly instead of scanning `memos` in full. A plain sorted array
   * cannot do this affordably here: real grammars constantly memoize
   * positions out of document order (sibling alternatives explore ahead
   * before an earlier alternative's own attempt finishes), so inserts are
   * *not* mostly-appends in practice — an array would pay O(n) per
   * out-of-order insert. A red-black tree keeps both insert and the
   * repeated "smallest remaining" eviction walk at O(log n).
   */
  private readonly order = new RedBlackTree<{ path: Path; pathKey: string }>(
    (a, b) => a.path.compareTo(b.path),
  );

  /**
   * The runtime's "low-water mark" tracker, one entry per currently
   * in-progress (not yet returned) rule frame, in nesting order. Memo entries
   * at positions strictly before the minimum start position of those frames
   * can never be revisited by any currently-active evaluation path (rule
   * call, left-recursive growth loop, or pending backtracking alternative),
   * because all of those can only ever consume forward from, or reset back
   * to, the start position of the rule frame that is running them — never
   * earlier.
   *
   * Entry `i` holds the minimum start position among frames `0..i` rather
   * than frame `i`'s own start, so the mark is always the top entry. Frames
   * nest as a stack, so this stays exact across pops while keeping the mark
   * O(1) to read no matter how deeply rules nest; scanning every active
   * frame on each return would make deeply nested input quadratic. Frames
   * also carry their memo entry (absent for rules that skip memoization),
   * which is how left-recursive seed dependencies are recorded.
   */
  private readonly active: Frame[] = [];

  /**
   * Looks up the reusable entry for `rule` with `args` at `path`.
   *
   * Reusing an in-progress entry (left recursion), or an entry computed
   * against an in-progress entry's current seed, makes every frame above that
   * in-progress entry depend on its seed too. An entry computed against a
   * seed that has since been superseded by a later growth iteration is stale
   * and reported as absent, so it is recomputed.
   */
  public resolve(
    path: Path,
    rule: Rule,
    args: Rule[],
  ): { key: symbol; memo: Memo | undefined } {
    const key = this.getKey([rule, ...args]);
    const { memo } = this.get(path, key);
    if (!memo) return { key, memo };
    if (memo.frame !== undefined) {
      this.observe(memo);
      return { key, memo };
    }
    if (isStale(memo)) return { key, memo: undefined };
    const live = liveSeed(memo);
    if (live) this.observe(live);
    return { key, memo };
  }

  /**
   * Records that every frame above `seed`'s own frame observed `seed`'s
   * current value. A frame keeps an existing dependency on a more deeply
   * nested in-progress entry: that entry's own dependency chain already
   * reaches `seed`, because it is marked by this same walk.
   */
  private observe(seed: Memo): void {
    const dependency: Seed = { memo: seed, iteration: seed.iteration };
    for (let i = this.active.length - 1; i > seed.frame!; i--) {
      const { memo } = this.active[i];
      if (!memo) continue;
      const nested = memo.seed?.memo.frame;
      if (nested === undefined || nested <= seed.frame!) {
        memo.seed = dependency;
      }
    }
  }

  public get(path: Path, key: symbol): { key: symbol; memo: Memo | undefined } {
    return { key, memo: this.memos.get(path.toString())?.entries.get(key) };
  }

  private getKey(rules: Rule[]): symbol {
    let keys = this.keys;
    let key: symbol;
    for (const rule of rules) {
      if (!keys.has(rule)) {
        keys.set(rule, { key: Symbol(), keys: new WeakMap() });
      }

      const entry = keys.get(rule)!;
      keys = entry.keys;
      key = entry.key;
    }

    return key!;
  }

  public set(path: Path, key: symbol, match: Match): Memo {
    const memo: Memo = { match, iteration: 0 };
    const pathKey = path.toString();
    const existing = this.memos.get(pathKey);
    if (existing) {
      existing.entries.set(key, memo);
    } else {
      this.memos.set(pathKey, { path, entries: new Map([[key, memo]]) });
      this.order.insert({ path, pathKey });
    }
    return memo;
  }

  public delete(path: Path, key: symbol): void {
    this.memos.get(path.toString())?.entries.delete(key);
  }

  /**
   * The number of distinct positions currently holding memo entries. Exposed
   * primarily for tests and diagnostics that want to observe eviction taking
   * effect.
   */
  public get size(): number {
    return this.memos.size;
  }

  /**
   * Marks a fresh rule invocation as active at `path` for the duration of
   * `fn`, then evicts memo entries that become provably unreachable once it
   * completes. Every fresh (non-memo-hit) rule call MUST be run through this
   * so eviction has an accurate view of what is still in progress. `memo` is
   * the invocation's own entry, marked in progress for the duration of `fn`.
   */
  public withFrame<T>(
    path: Path,
    fn: () => Awaitable<T>,
    memo?: Memo,
  ): Awaitable<T> {
    const enclosing = this.active.at(-1)?.mark;
    const mark = enclosing && enclosing.compareTo(path) <= 0 ? enclosing : path;
    if (memo) memo.frame = this.active.length;
    this.active.push({ mark, memo });
    return ensure(fn, () => {
      if (memo) memo.frame = undefined;
      this.active.pop();
      this.evict();
    });
  }

  private evict(): void {
    const mark = this.active.at(-1)?.mark;
    if (!mark) {
      // Nothing is in progress any more (the outermost rule frame just
      // returned): nothing currently reachable through this table is still
      // needed for evaluation. Anything the delivered result still
      // references stays alive independently, via ordinary reachability.
      this.memos.clear();
      this.order.clear();
      return;
    }

    // Repeatedly pop the smallest remaining position and delete it by key
    // as long as it is still strictly before the mark. `min()`/`remove()`
    // are each O(log n), and every entry is ever popped at most once across
    // the table's whole lifetime, so this costs O(log n) when nothing is
    // evictable and amortized O(k log n) for the k entries that are.
    let next = this.order.min();
    while (next !== null && next.path.compareTo(mark) < 0) {
      this.memos.delete(next.pathKey);
      this.order.remove(next);
      next = this.order.min();
    }
  }
}
