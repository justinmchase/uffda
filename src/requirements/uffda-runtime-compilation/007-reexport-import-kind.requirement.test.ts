import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { MatchKind } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { runUffdaRuntimeCompiler } from "../../lang/uffda/runtime.compiler.ts";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:uffda-runtime-compilation-007 - runtime compiler normalizes re-exports",
  async () => {
    const source = await Deno.readTextFile(
      join(repoRoot, "src/lang/uffda/runtime.compiler.ts"),
    );
    assertEquals(source.includes("normalizeModule"), true);
    assertEquals(source.includes("ExpressionKind.Native"), true);

    const stdHelper = await Deno.readTextFile(
      join(repoRoot, "src/runtime/std/normalize_module.ts"),
    );
    assertEquals(stdHelper.includes("ExportDeclarationKind.Import"), true);

    const match = await runUffdaRuntimeCompiler({
      kind: "module",
      declarations: [
        {
          kind: "import",
          moduleUrl: "./digit.uff",
          names: ["Digit"],
        },
        {
          kind: "export",
          name: "Digit",
        },
      ],
    });
    assertEquals(match.kind, MatchKind.Ok);
    if (match.kind === MatchKind.Ok) {
      assertEquals(match.value.exports, [{
        kind: ExportDeclarationKind.Import,
        name: "Digit",
      }]);
      assertEquals(match.value.imports[0]?.kind, ImportDeclarationKind.Module);
    }
  },
);
