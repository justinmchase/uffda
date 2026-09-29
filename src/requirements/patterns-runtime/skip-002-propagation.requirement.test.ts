import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { executeUffdaSource } from "../../lang/uffda/execute.ts";
import { unwrap } from "../../wrapped.ts";

async function run(rules: string, input: Input) {
  return await executeUffdaSource(`export Main; ${rules}`, {
    entryRuleName: "Main",
    input,
  });
}

Deno.test("req:skip-002 - skipped success propagation", async (t) => {
  await t.step("a quantifier omits skipped repetitions", async () => {
    const m = await run(
      `rule Main = (string | skip)*;`,
      Input.Iterable(["a", 1, "b", 2]),
    );
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(unwrap(m.value), ["a", "b"]);
  });

  await t.step("a skipped capture stays bound for the expression", async () => {
    const m = await run(
      `rule Main = [skip sep:string rest:string*] -> (join rest sep);`,
      Input.Iterable([[".", "a", "b", "c"]]),
    );
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(unwrap(m.value), "a.b.c");
  });

  await t.step("a skipping rule is omitted where referenced", async () => {
    const m = await run(
      `rule Ws = skip " "*; rule Word = "a"; rule Main = (Word | Ws)*;`,
      Input.Iterable("a a  a"),
    );
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(unwrap(m.value), ["a", "a", "a"]);
  });

  await t.step("a sequence of only skips is an empty array", async () => {
    const m = await run(`rule Main = skip "a" skip "b";`, Input.Iterable("ab"));
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(unwrap(m.value), []);
  });

  await t.step("a rule expression over a skip is ordinary", async () => {
    const m = await run(`rule Main = skip "a" -> 1;`, Input.Iterable("a"));
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(unwrap(m.value), 1);
  });

  await t.step(
    "skipped children are omitted while growing left recursion",
    async () => {
      const m = await run(
        `rule Main = Main skip "," "a" | "a";`,
        Input.Iterable("a,a,a"),
      );
      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind !== MatchKind.Ok) return;
      assertEquals(unwrap(m.value), [["a", "a"], "a"]);
    },
  );

  await t.step(
    "a left-recursive rule whose growth skips is skipped",
    async () => {
      const m = await run(
        `rule Main = skip (Main "a") | skip "a";`,
        Input.Iterable("aaa"),
      );
      assertEquals(m.kind, MatchKind.Skip);
      if (m.kind !== MatchKind.Skip) return;
      assertEquals(await m.scope.stream.done(), true);
    },
  );

  await t.step("not over a skipped success fails", async () => {
    const m = await run(`rule Main = not skip "a";`, Input.Iterable("a"));
    assertEquals(m.kind, MatchKind.Fail);
  });
});
