import { type } from "@justinmchase/type";
import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import {
  Input,
  InputNormalizationMode,
  type SourceProvenance,
  sourceProvenanceFrom,
} from "../../input.ts";
import { match } from "../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { IntoPattern } from "./pattern.ts";
import { leafOffset } from "../../span.ts";

function provenanceForIntoItem(
  value: unknown,
  parent: Input,
  item: Input,
): SourceProvenance | undefined {
  const fromValue = sourceProvenanceFrom(value);
  if (fromValue) return fromValue;

  if (typeof value === "string" && parent.provenance?.itemSpans) {
    // Stream leaf indices are 1-based; itemSpans is 0-based.
    const index = leafOffset(item.path) - 1;
    const span = index >= 0
      ? parent.provenance.itemSpans[index]
      : parent.provenance.itemSpans[0];
    if (span) {
      return {
        normalizationMap: Array.from(
          { length: value.length + 1 },
          (_, offset) => span.original.start + offset,
        ),
      };
    }
  }

  return parent.provenance;
}

export async function into(pattern: IntoPattern, scope: Scope): Promise<Match> {
  if (await scope.stream.done()) {
    return fail(scope, pattern);
  }

  const next = await scope.stream.next();
  if (!Input.isIterable(next.value) && !Input.isAsyncIterable(next.value)) {
    const [t] = type(next.value);
    return error(
      scope,
      pattern,
      MatchErrorCode.IterableExpected,
      `expected value to be iterable but got type ${t}`,
    );
  }

  const innerStream = new Input(
    next.value,
    scope.stream.path.push(0),
    0,
    undefined,
    InputNormalizationMode.Iterable,
    false,
    provenanceForIntoItem(next.value, scope.stream, next),
  );
  const innerScope = scope
    .withInput(innerStream);

  const m = await match(pattern.pattern, innerScope);
  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Fail:
      return fail(scope, pattern, [m]);
    case MatchKind.Ok: {
      if (!(await m.scope.stream.done())) {
        // Must consume entire stream to succeed
        return fail(scope, pattern, [m]);
      }

      const end = scope
        .withInput(next)
        .addVariables(m.scope.variables);
      return ok(scope, end, pattern, m.value, [m]);
    }
  }

  return error(
    scope,
    pattern,
    MatchErrorCode.InvalidArgument,
    `unexpected match kind ${
      (m as { kind?: unknown }).kind
    } in into child pattern`,
  );
}
