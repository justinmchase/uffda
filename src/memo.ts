import type { Path } from "./path.ts";
import type { Match } from "./match.ts";
import type { Rule } from "./runtime/modules/mod.ts";

export type Memo = { match: Match };

type RecursiveWeakMap = WeakMap<Rule, { key: symbol, keys: RecursiveWeakMap }>;

export class Memos {
  private readonly keys: RecursiveWeakMap = new WeakMap()
  private readonly memos = new WeakMap<Path, WeakMap<symbol, Memo>>();

  public resolve(path: Path, rule: Rule, args: Rule[]): { key: symbol, memo: Memo | undefined } {
    const key = this.getKey([rule, ...args]);
    return this.get(path, key);
  }

  public get(path: Path, key: symbol): { key: symbol, memo: Memo | undefined } {
    return { key, memo: this.memos.get(path)?.get(key) };
  }

  private getKey(rules: Rule[]): symbol {
    let keys = this.keys;
    let key: symbol;
    for(const rule of rules) {
      if (!keys.has(rule)) {
        keys.set(rule, { key: Symbol(), keys: new WeakMap() })
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
}
