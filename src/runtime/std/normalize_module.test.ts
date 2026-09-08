import { assertEquals } from "@std/assert";
import { ExportDeclarationKind } from "../declarations/export.ts";
import { ImportDeclarationKind } from "../declarations/import.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { normalizeModule } from "./normalize_module.ts";

Deno.test("std.normalizeModule leaves rule exports that match local rules", () => {
  assertEquals(
    normalizeModule({
      imports: [],
      exports: [{ kind: ExportDeclarationKind.Rule, name: "Main" }],
      rules: [{
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
      }],
    }),
    {
      imports: [],
      exports: [{ kind: ExportDeclarationKind.Rule, name: "Main" }],
      rules: [{
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
      }],
    },
  );
});

Deno.test("std.normalizeModule rewrites bare import re-exports", () => {
  assertEquals(
    normalizeModule({
      imports: [{
        kind: ImportDeclarationKind.Module,
        moduleUrl: "./digit.uff",
        names: ["Digit"],
      }],
      exports: [{ kind: ExportDeclarationKind.Rule, name: "Digit" }],
      rules: [],
    }),
    {
      imports: [{
        kind: ImportDeclarationKind.Module,
        moduleUrl: "./digit.uff",
        names: ["Digit"],
      }],
      exports: [{ kind: ExportDeclarationKind.Import, name: "Digit" }],
      rules: [],
    },
  );
});
