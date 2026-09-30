import { assertEquals } from "@std/assert";
import { Type } from "@justinmchase/type";
import { patternGrammar } from "../lang/pattern/pattern.lang.ts";
import { MatchKind, valueOf } from "../match.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import {
  CliMatchFailureCode,
  matchCliPattern,
  parseCliMatchInput,
} from "./match.ts";

Deno.test("cli.match applies raw pattern ASTs to text input", async (t) => {
  await t.step("returns a successful pattern value", async () => {
    const parsed = await patternGrammar("any");
    assertEquals(parsed.kind, MatchKind.Ok);
    if (parsed.kind !== MatchKind.Ok) return;

    const result = await matchCliPattern(valueOf(parsed), "a");
    assertEquals(result, { ok: true, value: "a" });
  });

  await t.step("reports a failed match", async () => {
    const parsed = await patternGrammar("fail");
    assertEquals(parsed.kind, MatchKind.Ok);
    if (parsed.kind !== MatchKind.Ok) return;

    const result = await matchCliPattern(valueOf(parsed), "b");
    assertEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.error.code, CliMatchFailureCode.MatchFailure);
    assertEquals(
      result.error.message,
      "Pattern 'fail' did not match input at [0]",
    );
  });

  await t.step("reports the rightmost nested pattern failure", async () => {
    const result = await matchCliPattern(
      {
        kind: PatternKind.Over,
        keys: {
          hello: { kind: PatternKind.Type, type: Type.Boolean },
        },
      },
      { hello: "not a boolean" },
      true,
    );
    assertEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(
      result.error.message,
      `Pattern 'type' did not match input at [0]."hello"`,
    );
  });

  await t.step("matches a decoded JSON number as one value", async () => {
    const parsed = await patternGrammar("number");
    assertEquals(parsed.kind, MatchKind.Ok);
    if (parsed.kind !== MatchKind.Ok) return;

    const input = parseCliMatchInput("42", true);
    assertEquals(input, { ok: true, value: 42 });
    if (!input.ok) return;

    const result = await matchCliPattern(valueOf(parsed), input.value, true);
    assertEquals(result, { ok: true, value: 42 });
  });

  await t.step("reports invalid JSON deterministically", () => {
    const input = parseCliMatchInput("{", true);
    assertEquals(input.ok, false);
    if (input.ok) return;
    assertEquals(input.error.code, CliMatchFailureCode.InvalidJson);
    assertEquals(input.error.phase, "input");
  });
});

Deno.test("cli.match reports recoveries", async (t) => {
  const recovering = async () => {
    const parsed = await patternGrammar(`(ope "a" sneak by any)* end`);
    assertEquals(parsed.kind, MatchKind.Ok);
    if (parsed.kind !== MatchKind.Ok) throw new Error("pattern parse failed");
    return valueOf(parsed);
  };

  await t.step("a clean match is unchanged", async () => {
    const result = await matchCliPattern(await recovering(), "aa");
    assertEquals(result, { ok: true, value: [["a", "a"], undefined] });
  });

  await t.step(
    "a recovered match fails with its value and every recovery",
    async () => {
      const result = await matchCliPattern(await recovering(), "axay");
      assertEquals(result.ok, false);
      if (result.ok) return;
      assertEquals(result.value, [["a", "x", "a", "y"], undefined]);
      assertEquals(
        result.diagnostics?.map(({ code, inputSpan }) => ({ code, inputSpan })),
        [
          {
            code: CliMatchFailureCode.Recovered,
            inputSpan: { start: 1, end: 2 },
          },
          {
            code: CliMatchFailureCode.Recovered,
            inputSpan: { start: 3, end: 4 },
          },
        ],
      );
      assertEquals(result.error, result.diagnostics?.[0]);
      assertEquals(result.error.message, 'Expected "a"\nUnexpected "x"');
    },
  );

  await t.step(
    "a failed match lists its recoveries before the failure",
    async () => {
      const parsed = await patternGrammar(`(ope "a" sneak by "x") "b" end`);
      assertEquals(parsed.kind, MatchKind.Ok);
      if (parsed.kind !== MatchKind.Ok) return;
      const result = await matchCliPattern(valueOf(parsed), "xc");
      assertEquals(result.ok, false);
      if (result.ok) return;
      assertEquals("value" in result, false);
      assertEquals(result.diagnostics?.map(({ code }) => code), [
        CliMatchFailureCode.Recovered,
        CliMatchFailureCode.MatchFailure,
      ]);
      assertEquals(result.error, result.diagnostics?.[1]);
    },
  );
});
