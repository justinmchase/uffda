import { MatchKind } from "../../match.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { Scope } from "../../runtime/scope.ts";
import { resolve } from "../../runtime/patterns/resolve.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";
import { line_starts } from "../../runtime/globals/line_starts.ts";
import {
  source_document,
  type SourceDocument,
} from "../../runtime/globals/source_document.ts";
import { type SourceUnit, units } from "../../runtime/globals/units.ts";

export type { SourceDocument, SourceUnit };
export { source_document };

/** @deprecated Prefer globals `line_starts`. */
export function buildLineStarts(text: string): number[] {
  return line_starts(text);
}

/** @deprecated Prefer globals `units`. */
export function buildUnits(
  text: string,
  lineStarts: number[],
  normalizationMap: number[],
): SourceUnit[] {
  return units(text, lineStarts, normalizationMap);
}

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
