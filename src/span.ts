import { Path } from "./mod.ts";
import { Scope } from "./runtime/scope.ts";

export type Span = {
  start: Path;
  end: Path;
};

export function spanFrom(start: Scope, end: Scope): Span {
  return {
    start: start.stream.path,
    end: end.stream.path,
  };
}
