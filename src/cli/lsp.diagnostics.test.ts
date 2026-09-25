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

  await t.step(
    "ranges an import failure on its specifier with related dependency info",
    () => {
      const source = 'import "./dep.uff" A;\nexport A;';
      const result: SessionLoadResult = {
        ok: false,
        error: {
          code: SessionLoadFailureCode.ResolutionFailure,
          phase: "resolve",
          message: 'Failed to compile "./dep.uff": bad',
          location: { offset: 7, line: 0, column: 7, endOffset: 18 },
          importChain: [{
            importerUrl: "file:///main.uff",
            importIndex: 0,
            moduleUrl: "./dep.uff",
            resolvedUrl: "file:///dep.uff",
          }],
          dependencyFailure: {
            moduleUrl: "file:///dep.uff",
            message: "bad",
            location: { offset: 12, line: 2, column: 3 },
          },
        },
        partiallyLoadedModules: [],
        resolvedDuringLoad: [],
      };
      const [diagnostic] = diagnosticsForSessionResult(result, source);
      assertEquals(diagnostic.range, {
        start: { line: 0, character: 7 },
        end: { line: 0, character: 18 },
      });
      assertEquals(diagnostic.source, "uffda (resolve)");
      assertEquals(diagnostic.relatedInformation, [{
        location: {
          uri: "file:///dep.uff",
          range: {
            start: { line: 2, character: 3 },
            end: { line: 2, character: 3 },
          },
        },
        message: "bad",
      }]);
    },
  );
});
