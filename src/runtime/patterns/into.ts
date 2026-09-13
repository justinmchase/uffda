import { type } from "@justinmchase/type";
import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import {
  Input,
  InputNormalizationMode,
  type SourceProvenance,
  sourceProvenanceFrom,
} from "../../input.ts";
import { compile } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { IntoPattern } from "./pattern.ts";
import { leafOffset } from "../../span.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

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

/** Compiles an `Into` pattern into a flattened, reusable closure. */
export function into(
  pattern: IntoPattern,
  scope: Scope,
): CompiledPattern {
  const child = compile(pattern.pattern, scope);
  return async (invocationScope: Scope) => {
    if (await invocationScope.stream.done()) {
      return fail(invocationScope, pattern);
    }

    const next = await invocationScope.stream.next();
    if (!Input.isIterable(next.value) && !Input.isAsyncIterable(next.value)) {
      const [t] = type(next.value);
      return error(
        invocationScope,
        pattern,
        MatchErrorCode.IterableExpected,
        `expected value to be iterable but got type ${t}`,
      );
    }

    const innerStream = new Input(
      next.value,
      invocationScope.stream.path.push(0),
      0,
      undefined,
      InputNormalizationMode.Iterable,
      false,
      provenanceForIntoItem(next.value, invocationScope.stream, next),
    );
    const innerScope = invocationScope
      .withInput(innerStream);

    const m = await child(innerScope);
    switch (m.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return m;
      case MatchKind.Fail:
        return fail(invocationScope, pattern, [m]);
      case MatchKind.Ok: {
        if (!(await m.scope.stream.done())) {
          // Must consume entire stream to succeed
          return fail(invocationScope, pattern, [m]);
        }

        const end = invocationScope
          .withInput(next)
          .addVariables(m.scope.variables);
        return ok(invocationScope, end, pattern, m.value, [m]);
      }
    }

    return error(
      invocationScope,
      pattern,
      MatchErrorCode.InvalidArgument,
      `unexpected match kind ${
        (m as { kind?: unknown }).kind
      } in into child pattern`,
    );
  };
}
