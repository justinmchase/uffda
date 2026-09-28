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
import { andThen, type AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import { rawOf } from "../../wrapped.ts";

function provenanceForIntoItem(
  value: unknown,
  parent: Input,
  item: Input,
): SourceProvenance | undefined {
  value = rawOf(value);
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
  return (invocationScope: Scope) =>
    andThen(invocationScope.stream.step(), (next): AwaitableMatch => {
      if (!next) {
        return fail(invocationScope, pattern);
      }
      const raw = rawOf(next.value);
      if (!Input.isIterable(raw) && !Input.isAsyncIterable(raw)) {
        const [t] = type(raw);
        return error(
          invocationScope,
          pattern,
          MatchErrorCode.IterableExpected,
          `expected value to be iterable but got type ${t}`,
        );
      }

      // The last item of an open input may itself still be written.
      const open = invocationScope.stream.open ? next.done() : false;
      return andThen(open, (innerOpen) => {
        const innerStream = new Input(
          next.value,
          invocationScope.stream.path.push(0),
          0,
          undefined,
          InputNormalizationMode.Iterable,
          false,
          provenanceForIntoItem(next.value, invocationScope.stream, next),
          false,
          innerOpen,
        );
        const innerScope = invocationScope
          .withInput(innerStream);

        return andThen(child(innerScope), (m): AwaitableMatch => {
          switch (m.kind) {
            case MatchKind.LR:
            case MatchKind.Error:
              return m;
            case MatchKind.Fail:
              return fail(invocationScope, pattern, [m]);
            case MatchKind.Ok:
              return andThen(m.scope.stream.done(), (done) => {
                if (!done) {
                  // Must consume entire stream to succeed
                  return fail(invocationScope, pattern, [m]);
                }
                const end = invocationScope
                  .withInput(next)
                  .addVariables(m.scope.variables);
                return ok(invocationScope, end, pattern, m.value, [m]);
              });
          }

          return error(
            invocationScope,
            pattern,
            MatchErrorCode.InvalidArgument,
            `unexpected match kind ${
              (m as { kind?: unknown }).kind
            } in into child pattern`,
          );
        });
      });
    });
}
