import { isSuccess, type MatchSuccess } from "../../match.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { Scope } from "../../runtime/scope.ts";
import { resolve } from "../../runtime/patterns/resolve.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";
import { valueOf } from "../../match.ts";

/** Built in src/lang/source/mod.uff (`unit_positions`/`to_source_unit`). */
export type SourceUnit = {
  index: number;
  value: string;
  offsetStart: number;
  offsetEnd: number;
  lineStart: number;
  columnStart: number;
  lineEnd: number;
  columnEnd: number;
};

/**
 * Assembled in src/lang/source/mod.uff via computed object keys + the
 * generic `iterable` global (`[(symbol "asyncIterator")]` is attached by
 * spreading `(iterable t)`), not by a TS constructor.
 */
export type SourceDocument = {
  documentId: string;
  text: string;
  lineStarts: number[];
  units: SourceUnit[];
  [Symbol.asyncIterator](): AsyncIterator<string>;
};

export async function normalizeSource(value: string): Promise<SourceDocument> {
  return valueOf(await sourceMatch(value)) as SourceDocument;
}

/**
 * The `Source` match for `value`. Its value is the wrapped document, whose
 * `text` characters carry their origins in `value`.
 */
export async function sourceMatch(value: string): Promise<MatchSuccess> {
  const moduleUrl = new URL("./mod.uff", import.meta.url);
  const resolver = new Resolver();
  const inputScope = Scope.From(value);
  const importScope = inputScope.withOptions({ resolver });
  const imported = await resolver.import(moduleUrl, {
    scope: importScope,
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: "Source",
    },
  });
  if (imported.kind !== ModuleImportResultKind.Module) {
    throw new Error("Failed to load source/mod.uff");
  }
  const result = await resolve(
    {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: "Source",
    },
    importScope.pushModule(imported.module),
  );
  if (!isSuccess(result)) {
    throw new Error(`Source normalization failed with ${result.kind}`);
  }
  return result;
}
