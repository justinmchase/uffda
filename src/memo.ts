import type { Path } from "./path.ts";
import type { Match } from "./match.ts";
import type { Rule } from "./runtime/modules/mod.ts";

export type Memo = { match: Match };

export class Memos {
  private readonly memos = new Map<Path, Map<Rule, Memo>>();

  public get(path: Path, rule: Rule): Memo | undefined {
    return this.memos.get(path)?.get(rule);
  }

  public set(path: Path, rule: Rule, match: Match): Memo {
    const memo = { match };
    if (this.memos.has(path)) {
      this.memos.get(path)?.set(rule, memo);
    } else {
      this.memos.set(path, new Map<Rule, Memo>([[rule, memo]]));
    }
    return memo;
  }
}
