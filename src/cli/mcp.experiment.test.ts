import { assert, assertEquals, assertExists } from "@std/assert";
import { walk } from "@std/fs/walk";
import { basename } from "@std/path";
import { CliLanguage } from "./contract.ts";
import {
  ExperimentFailureCode,
  experimentToolHandler,
} from "./mcp.experiment.ts";

async function snapshotPaths(root: string): Promise<Map<string, number>> {
  const paths = new Map<string, number>();
  try {
    for await (
      const entry of walk(root, {
        includeDirs: false,
        followSymlinks: false,
      })
    ) {
      const info = await Deno.stat(entry.path);
      paths.set(entry.path, info.mtime?.getTime() ?? 0);
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  return paths;
}

/** Formatting heuristic only — not country-aware phone validation. */
const PHONE_NORMALIZE = `
export Normalize;
rule D = "0".."9";
rule Sep = " " | "-" | "(" | ")" | ".";
rule Normalize =
  any*
  |> [
    plus:("+"?)
    body:(skip Sep | D)*
    end
    -> (join (flat (pack plus body)) "")
  ]
  |> [
    plus:("+"?)
    digits:D*7..15
    end
    -> (join (flat (pack plus digits)) "")
  ];
`;

Deno.test(
  "req:mcp-server-014 - empty source fails validation without inventing a run",
  async () => {
    const result = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: "  ",
    });
    assertEquals(result.ok, false);
    assertEquals(result.summary.parseOk, false);
    assertEquals(result.failures, undefined);
    assertExists(result.parseError);
    assertEquals(
      (result.parseError as { code: string }).code,
      ExperimentFailureCode.InvalidSource,
    );
  },
);

Deno.test(
  "req:mcp-server-014 - pattern parse-only succeeds without a fabricated match",
  async () => {
    const result = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: "n:number+",
    });
    assertEquals(result.ok, true);
    assertEquals(result.summary.parseOk, true);
    assertEquals(result.summary.total, 0);
    assertEquals(result.failures, undefined);
    assertEquals(result.cases, undefined);
  },
);

Deno.test(
  "req:mcp-server-014 - pattern match success, failure, projection, and JSON vs text",
  async () => {
    const projected = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: 'x:any -> (pack x "ok")',
      cases: [{ name: "proj", input: "a", expect: ["a", "ok"] }],
    });
    assertEquals(projected.ok, true);
    assertEquals(projected.summary.passed, 1);

    const miss = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: '"exact"',
      cases: [{ name: "miss", input: "nope" }],
    });
    assertEquals(miss.ok, false);
    assertEquals(miss.summary.parseOk, true);
    assertExists(miss.failures);
    assertEquals(miss.failures![0].ok, false);
    assertEquals(miss.failures![0].error?.kind, "match");
    assertEquals(miss.failures![0].error?.phase, "match");

    const text = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: "any",
      cases: [{ name: "text", input: '["ab"]', expect: "[" }],
      inputIsJson: false,
    });
    assertEquals(text.ok, true);

    const json = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: "any",
      cases: [{
        name: "json",
        input: '["ab"]',
        expect: ["ab"],
        inputIsJson: true,
      }],
    });
    assertEquals(json.ok, true);
  },
);

Deno.test(
  "req:mcp-server-014 - multiple pattern inputs produce independent ordered results",
  async () => {
    const result = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: '"a"+',
      inputs: ["aa", "b", "aaa"],
      verbose: true,
    });
    assertEquals(result.summary.parseOk, true);
    assertExists(result.cases);
    assertEquals(result.cases!.length, 3);
    assertEquals(result.cases![0].ok, true);
    assertEquals(result.cases![1].ok, false);
    assertEquals(result.cases![2].ok, true);
    assertEquals(result.ok, false);
    assertEquals(result.summary.failed, 1);
  },
);

Deno.test(
  "req:mcp-server-014 - expression evaluates with variables; parse errors stay parse",
  async () => {
    const ok = await experimentToolHandler({
      language: CliLanguage.Expression,
      source: "(add a 1)",
      variables: { a: 41 },
      cases: [{ name: "add", input: "", expect: 42 }],
    });
    assertEquals(ok.ok, true);

    const bad = await experimentToolHandler({
      language: CliLanguage.Expression,
      source: "(add",
    });
    assertEquals(bad.ok, false);
    assertEquals(bad.summary.parseOk, false);
    assertEquals(bad.failures, undefined);
    assertExists(bad.parseError);
    assertEquals((bad.parseError as { phase: string }).phase, "parse");
  },
);

Deno.test(
  "req:mcp-server-014 - self-contained module runs; imports are unsupported for run",
  async () => {
    const module = await experimentToolHandler({
      language: CliLanguage.FullUffda,
      source: "export Main;\nrule Main = x:any -> (echo x);\n",
      cases: [
        { name: "a", input: "ab", expect: "a" },
        { name: "z", input: "z", expect: "z" },
      ],
    });
    assertEquals(module.summary.parseOk, true);
    assertEquals(module.unsupported, undefined);
    assertEquals(module.ok, true);

    const withImport = await experimentToolHandler({
      language: CliLanguage.FullUffda,
      source: 'import "./other.uff" Other;\nexport Main;\nrule Main = Other;\n',
      cases: [{ name: "x", input: "x" }],
    });
    assertEquals(withImport.summary.parseOk, true);
    assertEquals(withImport.ok, false);
    assertEquals(withImport.failures, undefined);
    assertExists(withImport.unsupported);
    assertEquals(
      withImport.unsupported!.code,
      ExperimentFailureCode.Unsupported,
    );
    assertEquals(withImport.unsupported!.kind, "unsupported");
  },
);

Deno.test(
  "req:mcp-server-014 - experiment does not write artifacts and does not leak state",
  async () => {
    const binBefore = await snapshotPaths("./bin");
    const tmp = await Deno.makeTempDir({ prefix: "uffda-experiment-" });
    try {
      const beforeTmp = await snapshotPaths(tmp);
      const first = await experimentToolHandler({
        language: CliLanguage.Pattern,
        source: "n:number",
        cases: [{ name: "seven", input: "7", expect: 7, inputIsJson: true }],
      });
      assertEquals(first.ok, true);

      const second = await experimentToolHandler({
        language: CliLanguage.Pattern,
        source: "n:number",
        cases: [{ name: "eight", input: "8", expect: 8, inputIsJson: true }],
      });
      assertEquals(second.ok, true);

      const binAfter = await snapshotPaths("./bin");
      assertEquals(binAfter, binBefore);

      const afterTmp = await snapshotPaths(tmp);
      assertEquals(afterTmp, beforeTmp);
      for await (const entry of Deno.readDir(".")) {
        if (!entry.isFile) continue;
        assert(
          !basename(entry.name).startsWith("uffda-experiment"),
          `unexpected file ${entry.name}`,
        );
      }
    } finally {
      await Deno.remove(tmp, { recursive: true });
    }
  },
);

Deno.test(
  "req:mcp-server-014 - invalid JSON input fails at input phase",
  async () => {
    const result = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: "any",
      cases: [{ name: "bad-json", input: "{not-json", inputIsJson: true }],
    });
    assertEquals(result.summary.parseOk, true);
    assertEquals(result.ok, false);
    assertEquals(result.failures![0].error?.kind, "input");
    assertEquals(result.failures![0].error?.phase, "input");
  },
);

Deno.test(
  "req:mcp-server-014 - named cases assert expects and expected nonmatches",
  async () => {
    const result = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: '"a"+',
      cases: [
        { name: "ok", input: "aa", expect: ["a", "a"] },
        { name: "reject", input: "x", expectNonMatch: true },
        { name: "wrong-expect", input: "a", expect: "nope" },
      ],
    });
    assertEquals(result.summary.parseOk, true);
    assertEquals(result.summary.passed, 2);
    assertEquals(result.summary.failed, 1);
    assertEquals(result.ok, false);
    assertExists(result.failures);
    assertEquals(result.failures!.length, 1);
    assertEquals(result.failures![0].name, "wrong-expect");
    assertEquals(result.failures![0].error?.kind, "assertion");
    assertEquals(result.failures![0].error?.expected, "nope");
    assertExists(result.failures![0].error?.actual);
    // Compact: no AST / source echo.
    assertEquals(
      JSON.stringify(result).includes('"a"+'),
      false,
    );
  },
);

Deno.test(
  "req:mcp-server-014 - phone normalizer cases (formatting heuristic, not numbering plans)",
  async () => {
    const result = await experimentToolHandler({
      language: CliLanguage.FullUffda,
      source: PHONE_NORMALIZE,
      rule: "Normalize",
      cases: [
        { name: "plain", input: "5551234567", expect: "5551234567" },
        { name: "plus", input: "+1 (555) 123-4567", expect: "+15551234567" },
        { name: "dots", input: "555.123.4567", expect: "5551234567" },
        { name: "too-short", input: "123456", expectNonMatch: true },
        { name: "too-long", input: "1234567890123456", expectNonMatch: true },
        { name: "letters", input: "555-CALL-NOW", expectNonMatch: true },
        { name: "mid-plus", input: "55+51234567", expectNonMatch: true },
      ],
    });
    assertEquals(result.summary.parseOk, true, Deno.inspect(result.parseError));
    assertEquals(result.unsupported, undefined, Deno.inspect(result));
    assertEquals(
      result.ok,
      true,
      Deno.inspect(result.failures ?? result),
    );
    assertEquals(result.summary.passed, 7);
    // Captured digits — not a placeholder constant.
    assert(
      !JSON.stringify(result).includes("555-0000"),
      "must not invent placeholder phone strings",
    );
  },
);

Deno.test(
  "req:mcp-server-014 - pipeline scalar-vs-iterable mistakes surface useful feedback",
  async () => {
    const result = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: 'any* |> "0".."9"+',
      cases: [{ name: "scalar-digits", input: "12" }],
    });
    assertEquals(result.ok, false);
    assertEquals(result.summary.parseOk, true);
    const failure = result.failures![0];
    assertEquals(failure.error?.kind, "match");
    assertExists(failure.error?.message);
    // Shape mismatch should be visible; into hint only when evidenced.
    const blob = JSON.stringify(failure.error);
    assert(
      blob.includes("actualType") || blob.includes("hint") ||
        blob.includes("expected") || blob.includes("pattern"),
      `expected enriched match diagnostics, got ${blob}`,
    );
  },
);
