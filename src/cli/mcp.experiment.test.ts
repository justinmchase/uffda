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

Deno.test(
  "req:mcp-server-014 - empty source fails validation without inventing a run",
  async () => {
    const result = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: "  ",
    });
    assertEquals(result.ok, false);
    assertEquals(result.parse.ok, false);
    assertEquals(result.runs, undefined);
    if (result.parse.ok) return;
    assertEquals(
      result.parse.error.code,
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
    assertEquals(result.parse.ok, true);
    assertEquals(result.runs, undefined);
  },
);

Deno.test(
  "req:mcp-server-014 - pattern match success, failure, projection, and JSON vs text",
  async () => {
    const projected = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: 'x:any -> (pack x "ok")',
      input: "a",
    });
    assertEquals(projected.ok, true);
    assertExists(projected.runs);
    assertEquals(projected.runs![0].ok, true);
    assertEquals(projected.runs![0].value, ["a", "ok"]);

    const miss = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: '"exact"',
      input: "nope",
    });
    assertEquals(miss.ok, false);
    assertExists(miss.runs);
    assertEquals(miss.runs![0].ok, false);
    assertEquals(miss.runs![0].error?.phase, "match");
    // Parse succeeded; failure is only in the run.
    assertEquals(miss.parse.ok, true);

    const text = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: "any",
      input: '["ab"]',
      inputIsJson: false,
    });
    assertEquals(text.ok, true);
    assertEquals(text.runs![0].value, "[");

    const json = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: "any",
      input: '["ab"]',
      inputIsJson: true,
    });
    assertEquals(json.ok, true);
    assertEquals(json.runs![0].value, ["ab"]);
  },
);

Deno.test(
  "req:mcp-server-014 - multiple pattern inputs produce independent ordered results",
  async () => {
    const result = await experimentToolHandler({
      language: CliLanguage.Pattern,
      source: '"a"+',
      inputs: ["aa", "b", "aaa"],
    });
    assertEquals(result.parse.ok, true);
    assertExists(result.runs);
    assertEquals(result.runs!.length, 3);
    assertEquals(result.runs![0].index, 0);
    assertEquals(result.runs![0].ok, true);
    assertEquals(result.runs![0].input, "aa");
    assertEquals(result.runs![1].index, 1);
    assertEquals(result.runs![1].ok, false);
    assertEquals(result.runs![1].input, "b");
    assertEquals(result.runs![2].index, 2);
    assertEquals(result.runs![2].ok, true);
    assertEquals(result.ok, false);
  },
);

Deno.test(
  "req:mcp-server-014 - expression evaluates with variables; parse errors stay parse",
  async () => {
    const ok = await experimentToolHandler({
      language: CliLanguage.Expression,
      source: "(add a 1)",
      variables: { a: 41 },
    });
    assertEquals(ok.ok, true);
    assertEquals(ok.runs![0].value, 42);

    const bad = await experimentToolHandler({
      language: CliLanguage.Expression,
      source: "(add",
    });
    assertEquals(bad.ok, false);
    assertEquals(bad.parse.ok, false);
    assertEquals(bad.runs, undefined);
    if (bad.parse.ok) return;
    assertEquals(bad.parse.error.phase, "parse");
  },
);

Deno.test(
  "req:mcp-server-014 - self-contained module runs; imports are unsupported for run",
  async () => {
    const module = await experimentToolHandler({
      language: CliLanguage.FullUffda,
      source: "export Main;\nrule Main = x:any -> (echo x);\n",
      inputs: ["ab", "z"],
    });
    assertEquals(module.parse.ok, true);
    assertEquals(module.unsupported, undefined);
    assertEquals(module.runs![0].ok, true);
    assertEquals(module.runs![0].value, "a");
    assertEquals(module.runs![1].value, "z");

    const withImport = await experimentToolHandler({
      language: CliLanguage.FullUffda,
      source: 'import "./other.uff" Other;\nexport Main;\nrule Main = Other;\n',
      input: "x",
    });
    assertEquals(withImport.parse.ok, true);
    assertEquals(withImport.ok, false);
    assertEquals(withImport.runs, undefined);
    assertExists(withImport.unsupported);
    assertEquals(
      withImport.unsupported!.code,
      ExperimentFailureCode.Unsupported,
    );
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
        input: "7",
        inputIsJson: true,
      });
      assertEquals(first.ok, true);
      assertEquals(first.runs![0].value, 7);

      const second = await experimentToolHandler({
        language: CliLanguage.Pattern,
        source: "n:number",
        input: "8",
        inputIsJson: true,
      });
      assertEquals(second.ok, true);
      assertEquals(second.runs![0].value, 8);
      // Second call must not see the first sample's value.
      assertEquals(first.runs![0].value, 7);

      const binAfter = await snapshotPaths("./bin");
      assertEquals(binAfter, binBefore);

      const afterTmp = await snapshotPaths(tmp);
      assertEquals(afterTmp, beforeTmp);
      // No new files under cwd with experiment-ish names either.
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
      input: "{not-json",
      inputIsJson: true,
    });
    assertEquals(result.parse.ok, true);
    assertEquals(result.ok, false);
    assertEquals(result.runs![0].ok, false);
    assertEquals(result.runs![0].error?.phase, "input");
  },
);
