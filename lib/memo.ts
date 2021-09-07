import { IRulePattern } from "./runtime/patterns/pattern.ts";
import { Path } from "./path.ts";
import { Match } from "./match.ts";
import { Reference } from "./reference.ts";

interface IMemo {
  match: Match;
  references: Reference[];
}

export class Memos {
  private readonly memos = new Map<Path, Map<IRulePattern, IMemo>>();

  public get(path: Path, rule: IRulePattern): IMemo | undefined {
    return this.memos.get(path)?.get(rule);
  }

  public set(path: Path, rule: IRulePattern, match: Match) {
    if (!this.memos.has(path)) {
      this.memos.set(path, new Map<IRulePattern, IMemo>());
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

  public ref(path: Path, rule: IRulePattern, reference: Reference) {
    this.memos.get(path)!.get(rule)!.references.push(reference);
  }
}
