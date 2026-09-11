import type { Path } from "./path.ts";
import type { Match } from "./match.ts";
import type { Rule } from "./runtime/modules/mod.ts";

export type Memo = { match: Match };

type RecursiveWeakMap = WeakMap<Rule, { key: symbol; keys: RecursiveWeakMap }>;

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
  private readonly memos = new Map<Path, Map<symbol, Memo>>();

  /**
   * Start positions of every currently in-progress (not yet returned) rule
   * frame, in nesting order. This is the runtime's "low-water mark" tracker:
   * memo entries at positions strictly before the minimum of these can never
   * be revisited by any currently-active evaluation path (rule call,
   * left-recursive growth loop, or pending backtracking alternative), because
   * all of those can only ever consume forward from, or reset back to, the
   * start position of the rule frame that is running them — never earlier.
   */
  private readonly active: Path[] = [];

  public resolve(
    path: Path,
    rule: Rule,
    args: Rule[],
  ): { key: symbol; memo: Memo | undefined } {
    const key = this.getKey([rule, ...args]);
    return this.get(path, key);
  }

  public get(path: Path, key: symbol): { key: symbol; memo: Memo | undefined } {
    return { key, memo: this.memos.get(path)?.get(key) };
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
    const memo = { match };
    if (this.memos.has(path)) {
      this.memos.get(path)?.set(key, memo);
    } else {
      this.memos.set(path, new Map<symbol, Memo>([[key, memo]]));
    }
    return memo;
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
   * so eviction has an accurate view of what is still in progress.
   */
  public async withFrame<T>(path: Path, fn: () => Promise<T>): Promise<T> {
    this.active.push(path);
    try {
      return await fn();
    } finally {
      this.active.pop();
      this.evict();
    }
  }

  private evict(): void {
    if (this.active.length === 0) {
      // Nothing is in progress any more (the outermost rule frame just
      // returned): nothing currently reachable through this table is still
      // needed for evaluation. Anything the delivered result still
      // references stays alive independently, via ordinary reachability.
      this.memos.clear();
      return;
    }

    let mark = this.active[0];
    for (let i = 1; i < this.active.length; i++) {
      if (this.active[i].compareTo(mark) < 0) {
        mark = this.active[i];
      }
    }

    for (const path of this.memos.keys()) {
      if (path.compareTo(mark) < 0) {
        this.memos.delete(path);
      }
    }
  }
}
