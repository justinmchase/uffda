import { assertEquals } from "@std/assert";
import {
  diagnosticsForMatch,
  diagnosticsForSessionResult,
  grammarUnavailableDiagnostic,
  LSP_GRAMMAR_UNAVAILABLE,
} from "./lsp.diagnostics.ts";
import { patternGrammar } from "../lang/pattern/pattern.lang.ts";
import { CliStreamFailureCode } from "./stream.ts";
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

Deno.test("cli.lsp.diagnostics publishes every parse diagnostic", () => {
  const recovery = {
    code: SessionLoadFailureCode.ParseRecovered,
    phase: "parse" as const,
    message: 'Expected "a"\nUnexpected "x"',
    location: { offset: 2, line: 0, column: 2, endOffset: 4 },
  };
  const failure = {
    code: SessionLoadFailureCode.ParseFailure,
    phase: "parse" as const,
    message: 'Expected ";"',
    location: { offset: 7, line: 1, column: 0 },
  };
  const result: SessionLoadResult = {
    ok: false,
    error: failure,
    diagnostics: [recovery, failure],
    partiallyLoadedModules: [],
    resolvedDuringLoad: [],
  };
  const diagnostics = diagnosticsForSessionResult(result, "a xx b\nc");
  assertEquals(
    diagnostics.map(({ range, code, message }) => ({ range, code, message })),
    [
      {
        range: {
          start: { line: 0, character: 2 },
          end: { line: 0, character: 4 },
        },
        code: SessionLoadFailureCode.ParseRecovered,
        message: recovery.message,
      },
      {
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 0 },
        },
        code: SessionLoadFailureCode.ParseFailure,
        message: failure.message,
      },
    ],
  );
});

Deno.test("cli.lsp.diagnostics diagnosticsForMatch", async (t) => {
  await t.step("yields no diagnostics for a clean parse", async () => {
    const source = "a | b";
    assertEquals(
      await diagnosticsForMatch(await patternGrammar(source), source),
      [],
    );
  });

  await t.step("reports a recovery over the source it skipped", async () => {
    const source = "a ! b";
    const diagnostics = await diagnosticsForMatch(
      await patternGrammar(source),
      source,
    );
    assertEquals(diagnostics.length, 1);
    assertEquals(diagnostics[0].code, CliStreamFailureCode.Recovered);
    assertEquals(diagnostics[0].source, "uffda (parse)");
    assertEquals(diagnostics[0].range, {
      start: { line: 0, character: 2 },
      end: { line: 0, character: 3 },
    });
  });

  await t.step(
    "anchors a failure after the last token of an unfinished line",
    async () => {
      const source = "(a |\n\n)";
      const diagnostics = await diagnosticsForMatch(
        await patternGrammar(source),
        source,
      );
      const failure = diagnostics.find((diagnostic) =>
        diagnostic.code === CliStreamFailureCode.ParseFailure
      );
      assertEquals(failure?.range.start, { line: 0, character: 4 });
    },
  );
});

Deno.test("cli.lsp.diagnostics grammarUnavailableDiagnostic", async (t) => {
  await t.step("ranges the message over the first line", () => {
    const diagnostic = grammarUnavailableDiagnostic("gone", "abc\ndef");
    assertEquals(diagnostic.code, LSP_GRAMMAR_UNAVAILABLE);
    assertEquals(diagnostic.message, "gone");
    assertEquals(diagnostic.range, {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 3 },
    });
  });

  await t.step("ranges a single-line document whole", () => {
    assertEquals(
      grammarUnavailableDiagnostic("gone", "abc").range.end,
      { line: 0, character: 3 },
    );
  });
});
