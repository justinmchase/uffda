import { uffdaGrammar } from "../../src/lang/uffda/uffda.lang.ts";

/**
 * Reports how `.uff` compile time (parsing `.uff` source text via the
 * self-hosted `uffdaGrammar`) scales with source size.
 *
 * This exists because compiling `examples/morse/morse.uff` (a ~6KB grammar)
 * once took roughly 90 seconds despite the compiled grammar itself running
 * against real input in milliseconds — proving the cost lived entirely in
 * the bootstrap parse of `.uff` source text, not in runtime pattern-matching
 * throughput. Root-caused to two compounding issues, both since fixed:
 *
 *  1. `Memos` (`src/memo.ts`) evicted stale entries by scanning its *entire*
 *     table on every single completed rule frame, making eviction cost grow
 *     with both input size and table size at once (effectively quadratic
 *     just for eviction bookkeeping). Fixed by keeping a second, position-
 *     ordered index (a `RedBlackTree`) so eviction pops only the entries
 *     that are actually stale, in `O(log n)` per call.
 *  2. `Scope` (`src/runtime/scope.ts`) constructed a fresh default options
 *     object — including a `new Resolver()`, which calls `Deno.cwd()` — on
 *     every scope derivation (`withInput`, `withMemos`, `addVariables`),
 *     even when a resolver was already supplied. That is a real syscall
 *     paid once per rule invocation. Fixed by only constructing whichever
 *     option was actually missing.
 *  3. `Scope.addVariables` flattened every inherited variable binding into
 *     a brand new `Map` on every call. Individual copies were small, but
 *     call volume was not (hundreds of thousands of calls for a few KB of
 *     source), so allocation/GC volume dominated. Fixed by `VariableScope`
 *     (`src/runtime/variable_scope.ts`), a chained/layered view that only
 *     flattens when something actually needs the full merged map.
 *
 * This report exists to make any future regression in this area visible as
 * superlinear growth in the timings below, rather than requiring another
 * from-scratch investigation. Run with `deno task perf`.
 *
 * In CI (`GITHUB_STEP_SUMMARY` set), the full size/time table is always
 * attached to the job summary. Locally, output stays terse by default (one
 * line, only shown when the full compile falls outside the expected bound)
 * — pass `--verbose` to always see the full breakdown.
 */

// Generous bound (current baseline is ~9s locally): this isn't a strict
// regression gate, just a trip-wire so a future reintroduction of
// superlinear behavior is obvious in CI output rather than silent.
const MAX_EXPECTED_FULL_COMPILE_MS = 30_000;

type Row = { lines: number; chars: number; ms: number; kind: string };

const source = await Deno.readTextFile(
  new URL("../../examples/morse/morse.uff", import.meta.url),
);
const lines = source.split("\n");

// Sample prefixes that end at complete top-level declaration boundaries
// (a line ending in `;`) rather than arbitrary line counts. Cutting mid
// declaration produces a syntactically incomplete, deliberately-invalid
// prefix — a legitimate parse failure that has nothing to do with the perf
// trend this report tracks, but reads as an alarming "fail" row next to an
// otherwise all-green report. Every sampled prefix here is a valid,
// parseable module on its own.
const boundaries: number[] = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trimEnd().endsWith(";")) boundaries.push(i);
}

const sampleCount = 7;
const sampledLineCounts = Array.from(
  { length: sampleCount },
  (_, i) =>
    boundaries[
      Math.round(i * (boundaries.length - 1) / (sampleCount - 1))
    ] + 1,
);

const rows: Row[] = [];
for (const n of sampledLineCounts) {
  const prefix = lines.slice(0, n).join("\n");
  const t0 = performance.now();
  const parsed = await uffdaGrammar(prefix);
  const ms = performance.now() - t0;
  rows.push({ lines: n, chars: prefix.length, ms, kind: parsed.kind });
}

const full = rows[rows.length - 1];
const withinExpected = full.ms <= MAX_EXPECTED_FULL_COMPILE_MS;

function toMarkdownTable(rows: Row[]): string {
  const header =
    "| lines | chars | time (ms) | result |\n| --- | --- | --- | --- |";
  const body = rows.map((r) =>
    `| ${r.lines} | ${r.chars} | ${r.ms.toFixed(1)} | ${r.kind} |`
  ).join("\n");
  return `${header}\n${body}`;
}

const summaryPath = Deno.env.get("GITHUB_STEP_SUMMARY");
if (summaryPath) {
  const heading = withinExpected
    ? `### \`.uff\` compile perf\n\nFull \`examples/morse/morse.uff\` compiled in **${
      full.ms.toFixed(1)
    }ms** (within the ${MAX_EXPECTED_FULL_COMPILE_MS}ms expected bound).`
    : `### \`.uff\` compile perf ⚠️\n\nFull \`examples/morse/morse.uff\` compiled in **${
      full.ms.toFixed(1)
    }ms**, exceeding the ${MAX_EXPECTED_FULL_COMPILE_MS}ms expected bound — investigate for a regression.`;
  await Deno.writeTextFile(
    summaryPath,
    `${heading}\n\n${toMarkdownTable(rows)}\n`,
    { append: true },
  );
}

const verbose = Deno.args.includes("--verbose");
if (withinExpected && !verbose) {
  console.log(
    `perf: examples/morse/morse.uff compiled in ${
      full.ms.toFixed(1)
    }ms (${full.chars} chars) — within expected bound (${MAX_EXPECTED_FULL_COMPILE_MS}ms). Pass --verbose for the full breakdown.`,
  );
} else {
  if (!withinExpected) {
    console.warn(
      `perf: full compile took ${
        full.ms.toFixed(1)
      }ms, exceeding the ${MAX_EXPECTED_FULL_COMPILE_MS}ms expected bound.`,
    );
  }
  console.log("lines\tchars\ttime (ms)\tresult");
  for (const r of rows) {
    console.log(`${r.lines}\t${r.chars}\t${r.ms.toFixed(1)}\t${r.kind}`);
  }
}
