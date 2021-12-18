import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { IErrorUntilPattern } from "./pattern.ts";
import { match } from "../match.ts";

// This rule only matches and produces an error if the supplied pattern
// eventually matches.
//
// It will keep incrementing the stream and trying again until it either 
// hits the end of the stream or matches the pattern. If it hits the
// end of the stream then it will fail to match. The caller shoul interpret
// an incomplete match as an error.

export function error(args: IErrorUntilPattern, scope: Scope): Match {
  const { name, message, pattern } = args;
  if (scope.stream.done) {
    return Match.Fail(scope);
  }

  let end = scope;
  let m = Match.Fail(scope);
  while (!end.stream.done) {
    m = match(pattern, end);
    if (m.matched) {
      m = m.setValue(undefined).pushError(
        name,
        message,
        scope,
        m.end
      );
      break;
    }

    const next = end.stream.next();
    end = scope.withStream(next);
  }

  return m;
}
