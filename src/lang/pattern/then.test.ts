import { assert, assertEquals } from "@std/assert";
import { isSuccess, type Match, valueOf } from "../../match.ts";
import { collectRecoveries } from "../../runtime/recovery.ts";
import { patternGrammar } from "./pattern.lang.ts";
import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./then.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.then",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "THEN_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Then",
        input: Input.Iterable(["any", "fail"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Then,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Fail },
          ],
        },
      }),
    });
  },
});

const skipped = (source: string, match: Match) =>
  collectRecoveries(match).map(({ match: { originalSpan } }) =>
    source.slice(originalSpan.start, originalSpan.end)
  );

Deno.test("lang.pattern.then recovers a stray token", async () => {
  const source = "a ! b";
  assertEquals((await patternGrammar(source)).kind, MatchKind.Fail);

  const match = await patternGrammar(source, { recovery: true });
  assert(isSuccess(match));
  assertEquals(valueOf(match).kind, PatternKind.Then);
  assertEquals(skipped(source, match), ["!"]);

  const delimited = await patternGrammar("(a !) | b", { recovery: true });
  assertEquals(skipped("(a !) | b", delimited), ["!"]);
});
