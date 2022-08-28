import { Match, MatchError } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { IErrorUntilPattern } from "./pattern.ts";
import { match } from "../match.ts";

// This rule only matches and produces an error if the supplied pattern
// eventually matches.
//
// It will keep incrementing the stream and trying again until it either 
// hits the end of the stream or matches the pattern. If it hits the
// end of the stream without encountering the end, then it will fail to match.
// The caller should interpret an incomplete match as an error.

export function error(args: IErrorUntilPattern, scope: Scope): Match {
  const { name, message, pattern } = args;
  if (scope.stream.done) {
    return Match.Fail(scope);
  }

  let end = scope;
  let m = Match.Fail(scope);
  while (true) {
    m = match(pattern, end);
    if (m.matched) {
      return Match.Ok(scope, m.end, undefined, [
        ...m.errors,
        new MatchError(
          name,
          message,
          scope,
          m.end
        )
      ]);
    } else if (end.stream.done) {
      break;
    }

    const next = end.stream.next();
    end = scope.withStream(next);
  }

  return Match.Fail(scope);
}