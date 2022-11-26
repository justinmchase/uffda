import { Path } from "./path.ts";
import { Match } from "./match.ts";
import { Reference } from "./reference.ts";
import { IRule } from "./modules.ts";

interface IMemo {
  match: Match;
  references: Reference[];
}

export class Memos {
  private readonly memos = new Map<Path, Map<IRule, IMemo>>();

  public get(path: Path, rule: IRule): IMemo | undefined {
    return this.memos.get(path)?.get(rule);
  }

  public set(path: Path, rule: IRule, match: Match) {
    if (!this.memos.has(path)) {
      this.memos.set(path, new Map<IRule, IMemo>());
    }

    if (!this.memos.get(path)!.has(rule)) {
      const memo = { match, references: [] };
      this.memos.get(path)!.set(rule, memo);
      return memo;
    } else {
      const memo = this.memos.get(path)!.get(rule)!;
      memo.match = match;
      return memo;
    }
  }

  public ref(path: Path, rule: IRule, reference: Reference) {
    this.memos.get(path)!.get(rule)!.references.push(reference);
  }
}
