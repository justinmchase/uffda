import { assertEquals } from "@std/assert";
import { diagnosticsForSessionResult } from "./lsp.diagnostics.ts";
import {
  SessionLoadFailureCode,
  type SessionLoadResult,
} from "./mcp.session.ts";

Deno.test("cli.lsp.diagnostics diagnosticsForSessionResult", async (t) => {
  await t.step("yields no diagnostics for a successful result", () => {
    const result: SessionLoadResult = {
      ok: true,
      module: { moduleUrl: "session:///s/0.uff", declarations: [] },
    };
    assertEquals(diagnosticsForSessionResult(result, "export Main;"), []);
  });

  await t.step(
    "reports a precise point range for a located parse failure",
    () => {
      const result: SessionLoadResult = {
        ok: false,
        error: {
          code: SessionLoadFailureCode.ParseFailure,
          phase: "parse",
          message: "unexpected end of input",
          location: { offset: 5, line: 0, column: 5 },
        },
        partiallyLoadedModules: [],
        resolvedDuringLoad: [],
      };
      const diagnostics = diagnosticsForSessionResult(result, "rule ");
      assertEquals(diagnostics.length, 1);
      assertEquals(diagnostics[0].range, {
        start: { line: 0, character: 5 },
        end: { line: 0, character: 5 },
      });
      assertEquals(diagnostics[0].message, "unexpected end of input");
      assertEquals(diagnostics[0].source, "uffda (parse)");
    },
  );

  await t.step(
    "falls back to a whole-document range for an unlocated compile failure",
    () => {
      const result: SessionLoadResult = {
        ok: false,
        error: {
          code: SessionLoadFailureCode.CompileFailure,
          phase: "compile",
          message: "duplicate export",
        },
        partiallyLoadedModules: [],
        resolvedDuringLoad: [],
      };
      const source = "export Main;\nrule Main = any;";
      const diagnostics = diagnosticsForSessionResult(result, source);
      assertEquals(diagnostics.length, 1);
      assertEquals(diagnostics[0].range.start, { line: 0, character: 0 });
      assertEquals(diagnostics[0].source, "uffda (compile)");
    },
  );
});
