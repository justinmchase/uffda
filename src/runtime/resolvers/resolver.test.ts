import { assertEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../patterns/pattern.ts";
import { Scope } from "../scope.ts";
import {
  type ImportFrame,
  moduleResolutionError,
  moduleResolutionResult,
  withImportFrame,
} from "./resolver.ts";

function frame(importerUrl: string, resolvedUrl: string): ImportFrame {
  return { importerUrl, importIndex: 0, moduleUrl: resolvedUrl, resolvedUrl };
}

Deno.test("runtime.resolvers.resolver withImportFrame", async (t) => {
  const failure = moduleResolutionResult(moduleResolutionError("nope", {
    scope: Scope.Default(),
    pattern: { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
  }));

  await t.step("starts a chain on an unattributed error", () => {
    const outer = frame("file:///a.uff", "file:///b.uff");
    const result = withImportFrame(failure, outer);
    assertEquals(result.importChain, [outer]);
    assertEquals(result.error.kind, MatchKind.Error);
    assertEquals(failure.importChain, undefined);
  });

  await t.step("prepends outer frames so the chain reads root-first", () => {
    const inner = frame("file:///b.uff", "file:///c.uff");
    const outer = frame("file:///a.uff", "file:///b.uff");
    const result = withImportFrame(withImportFrame(failure, inner), outer);
    assertEquals(result.importChain, [outer, inner]);
  });
});
