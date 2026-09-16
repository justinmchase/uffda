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
    "reports a precise token range for a located parse failure",
    () => {
      const result: SessionLoadResult = {
        ok: false,
        error: {
          code: SessionLoadFailureCode.ParseFailure,
          phase: "parse",
          message: 'Expected ";"\nUnexpected "any"',
          location: { offset: 9, line: 0, column: 9, endOffset: 12 },
        },
        partiallyLoadedModules: [],
        resolvedDuringLoad: [],
      };
      const diagnostics = diagnosticsForSessionResult(result, "rule A = any");
      assertEquals(diagnostics.length, 1);
      assertEquals(diagnostics[0].range, {
        start: { line: 0, character: 9 },
        end: { line: 0, character: 12 },
      });
      assertEquals(diagnostics[0].message, 'Expected ";"\nUnexpected "any"');
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
