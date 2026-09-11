import { MatchKind } from "../../match.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { Scope } from "../../runtime/scope.ts";
import { resolve } from "../../runtime/patterns/resolve.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";

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
  originalOffsetStart: number;
  originalOffsetEnd: number;
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
  normalizationMap: number[];
  [Symbol.asyncIterator](): AsyncIterator<string>;
};

export async function normalizeSource(value: string): Promise<SourceDocument> {
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
  if (result.kind !== MatchKind.Ok) {
    throw new Error(`Source normalization failed with ${result.kind}`);
  }
  return result.value as SourceDocument;
}
