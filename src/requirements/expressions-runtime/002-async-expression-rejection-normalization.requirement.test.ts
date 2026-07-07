import { assertEquals, assertStrictEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Resolver } from "../../mod.ts";
import {
  ExportDeclarationKind,
  type ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";
import { resolve } from "../../runtime/patterns/resolve.ts";
import { Scope } from "../../runtime/scope.ts";

Deno.test("req:expressions-runtime-002 - Async expression rejections are normalized at the pattern-expression boundary", async (t) => {
  await t.step(
    "rejected Error becomes ExpressionException and preserves error identity",
    async () => {
      const declarations: Record<string, ModuleDeclaration> = {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "P0",
            default: true,
          }],
          rules: [
            {
              name: "P0",
              parameters: [],
              pattern: { kind: PatternKind.Any },
              expression: {
                kind: ExpressionKind.Native,
                fn: () =>
                  Promise.reject(new ReferenceError("missing async ref")),
              },
            },
          ],
        },
      };

      const resolver = new Resolver({ declarations });
      const importScope = new Scope(
        undefined,
        undefined,
        undefined,
        undefined,
        Input.Iterable("a"),
        undefined,
        undefined,
        { resolver },
      );
      const module = await resolver.import(new URL(import.meta.url), {
        scope: importScope,
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Run,
        },
      });
      assertEquals(module.kind, ModuleImportResultKind.Module);
      if (module.kind !== ModuleImportResultKind.Module) return;
      const scope = new Scope(
        module.module,
        undefined,
        undefined,
        undefined,
        Input.Iterable("a"),
        undefined,
        undefined,
        { resolver },
      );

      const m = await resolve(
        { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
        scope,
      );

      assertEquals(m.kind, MatchKind.Error);
      if (m.kind !== MatchKind.Error) return;
      assertEquals(m.code, MatchErrorCode.ExpressionException);
      assertEquals(m.message, "expression exception: missing async ref");
      assertEquals(m.error instanceof ReferenceError, true);
      assertStrictEquals(m.cause, m.error);
    },
  );

  await t.step(
    "rejected non-Error value becomes ExpressionException and preserves raw cause",
    async () => {
      const declarations: Record<string, ModuleDeclaration> = {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "P0",
            default: true,
          }],
          rules: [
            {
              name: "P0",
              parameters: [],
              pattern: { kind: PatternKind.Any },
              expression: {
                kind: ExpressionKind.Native,
                fn: () => Promise.reject("boom-async"),
              },
            },
          ],
        },
      };

      const resolver = new Resolver({ declarations });
      const importScope = new Scope(
        undefined,
        undefined,
        undefined,
        undefined,
        Input.Iterable("a"),
        undefined,
        undefined,
        { resolver },
      );
      const module = await resolver.import(new URL(import.meta.url), {
        scope: importScope,
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Run,
        },
      });
      assertEquals(module.kind, ModuleImportResultKind.Module);
      if (module.kind !== ModuleImportResultKind.Module) return;
      const scope = new Scope(
        module.module,
        undefined,
        undefined,
        undefined,
        Input.Iterable("a"),
        undefined,
        undefined,
        { resolver },
      );

      const m = await resolve(
        { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
        scope,
      );

      assertEquals(m.kind, MatchKind.Error);
      if (m.kind !== MatchKind.Error) return;
      assertEquals(m.code, MatchErrorCode.ExpressionException);
      assertEquals(m.message, "expression exception: boom-async");
      assertStrictEquals(m.error, undefined);
      assertEquals(m.cause, "boom-async");
    },
  );
});
