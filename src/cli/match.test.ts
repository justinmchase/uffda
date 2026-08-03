import { assertEquals } from "@std/assert";
import { Type } from "@justinmchase/type";
import { patternGrammar } from "../lang/pattern/pattern.lang.ts";
import { MatchKind } from "../match.ts";
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

    const result = await matchCliPattern(parsed.value, "a");
    assertEquals(result, { ok: true, value: "a" });
  });

  await t.step("reports a failed match", async () => {
    const parsed = await patternGrammar("fail");
    assertEquals(parsed.kind, MatchKind.Ok);
    if (parsed.kind !== MatchKind.Ok) return;

    const result = await matchCliPattern(parsed.value, "b");
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

    const result = await matchCliPattern(parsed.value, input.value, true);
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
