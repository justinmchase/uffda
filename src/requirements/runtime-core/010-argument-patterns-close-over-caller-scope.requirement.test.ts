import { assertEquals } from "@std/assert";
import { executeUffdaSource } from "../../lang/uffda/execute.ts";
import { Input } from "../../input.ts";
import { MatchKind, valueOf } from "../../match.ts";
import { unwrap } from "../../wrapped.ts";

const source = `
export Closure;
export Parameter;
export Inner;
export Named;

rule Show<C> = s:string c:C -> (join [s c] "@");
rule Closure = x:string r:Show<(ok -> (add (length x) 1))> -> r;

rule Pass<P> = r:Show<(p:P -> p)> -> r;
rule Parameter = Pass<(ok -> "param")>;

rule Bind<C> = C (ok -> y);
rule Inner = Bind<(y:string -> y)>;

rule Column = ok -> (length x);
rule Named = x:string r:Show<Column> -> r;
`;

const run = async (entryRuleName: string) =>
  await executeUffdaSource(source, {
    entryRuleName,
    input: Input.Iterable(["abc", "next"]),
  });

Deno.test(
  "req:runtime-core-010 - an inline argument pattern sees the caller's variables",
  async () => {
    const m = await run("Closure");
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) assertEquals(unwrap(valueOf(m)), "next@4");
  },
);

Deno.test(
  "req:runtime-core-010 - an inline argument pattern still sees the caller's rule arguments",
  async () => {
    const m = await run("Parameter");
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) assertEquals(unwrap(valueOf(m)), "abc@param");
  },
);

Deno.test(
  "req:runtime-core-010 - variables bound inside an argument stay inside it",
  async () => {
    const m = await run("Inner");
    assertEquals(m.kind, MatchKind.Error);
    if (m.kind === MatchKind.Error) {
      assertEquals(m.message.includes("unknown reference: y"), true);
    }
  },
);

Deno.test(
  "req:runtime-core-010 - a declared rule passed by name does not see the caller's variables",
  async () => {
    const m = await run("Named");
    assertEquals(m.kind, MatchKind.Error);
    if (m.kind === MatchKind.Error) {
      assertEquals(m.message.includes("unknown reference: x"), true);
    }
  },
);
