import { assertEquals, assertThrows } from "@std/assert";
import {
  argumentCases,
  argumentOutcome,
  executionCases,
  executionOutcome,
  portableOutcome,
} from "./cli-compatibility-matrix.ts";
import fixtures from "./cli-compatibility-matrix.json" with { type: "json" };

Deno.test("req:cli-command-model-005 - reference verifies persistent argument matrix", () => {
  assertEquals(
    argumentCases(),
    fixtures.arguments.map(({ name, args }) => ({ name, args })),
  );
  for (const entry of fixtures.arguments) {
    assertEquals<unknown>(
      argumentOutcome(entry.args),
      entry.expected,
      entry.name,
    );
  }
});

Deno.test("req:cli-command-model-005 - reference verifies supported command execution matrix", async (t) => {
  const cases = executionCases();
  assertEquals<unknown>(
    cases,
    fixtures.executions.map((
      {
        expected: _expected,
        rustExpected: _rustExpected,
        astSource: _astSource,
        ...entry
      },
    ) => entry),
  );
  for (const [index, entry] of cases.entries()) {
    await t.step(entry.name, async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-cli-matrix-" });
      try {
        assertEquals<unknown>(
          portableOutcome(entry, await executionOutcome(entry, cwd)),
          fixtures.executions[index].expected,
        );
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    });
  }
});

Deno.test("req:cli-command-model-005 - native diagnostic text projection preserves structured fields", () => {
  const entry = {
    name: "native failure",
    args: [],
    stdin: "",
    files: {},
    output: "json",
    nativeDiagnostics: true,
  } satisfies Parameters<typeof portableOutcome>[0];
  assertEquals(
    portableOutcome(entry, {
      error: {
        code: "CLI_USAGE",
        phase: "validation",
        message: "native error",
        inputPosition: "[0]",
      },
    }),
    {
      error: {
        code: "CLI_USAGE",
        phase: "validation",
        message: "<native diagnostic text>",
        inputPosition: "[0]",
      },
    },
  );
  assertThrows(
    () => portableOutcome(entry, { error: { message: "" } }),
    Error,
    "nonempty",
  );
});
