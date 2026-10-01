import { assertEquals } from "@std/assert";
import { executeUffdaSource } from "../../lang/uffda/execute.ts";
import { Input } from "../../input.ts";
import { MatchKind, valueOf } from "../../match.ts";
import { unwrap } from "../../wrapped.ts";

const source = `
export Shadow;
export Leak;
export Lambda;
export Mismatch;

func Twice<x:string> = (join [x x] "");
func Peek<> = x;
rule Shadow = x:string -> (Twice "b");
rule Leak = x:string -> (Peek);
rule Lambda = x:string -> (join [...(map ["z"] <y:string> -> (join [x y] "-"))] "");
rule Mismatch = x:string -> (Twice 1);
`;

const run = async (entryRuleName: string) =>
  await executeUffdaSource(source, {
    entryRuleName,
    input: Input.Iterable(["abc"]),
  });

Deno.test(
  "req:runtime-core-011 - a func parameter may reuse a caller variable's name",
  async () => {
    const m = await run("Shadow");
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) assertEquals(unwrap(valueOf(m)), "bb");
  },
);

Deno.test(
  "req:runtime-core-011 - a func body does not see the caller's variables",
  async () => {
    const m = await run("Leak");
    assertEquals(m.kind, MatchKind.Error);
    if (m.kind === MatchKind.Error) {
      assertEquals(m.message.includes("unknown reference: x"), true);
    }
  },
);

Deno.test(
  "req:runtime-core-011 - a lambda sees variables where it is written",
  async () => {
    const m = await run("Lambda");
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) assertEquals(unwrap(valueOf(m)), "abc-z");
  },
);

Deno.test(
  "req:runtime-core-011 - an argument mismatch raises at the call site",
  async () => {
    const m = await run("Mismatch");
    assertEquals(m.kind, MatchKind.Error);
    if (m.kind === MatchKind.Error) {
      assertEquals(
        m.message.includes("arguments did not match parameter pattern"),
        true,
      );
    }
  },
);
