import { assert, assertEquals } from "@std/assert";
import { Input, InputNormalizationMode } from "./input.ts";
import { unwrap } from "./wrapped.ts";

Deno.test("input advances through promises over async items", async () => {
  const input = Input.From(
    (async function* () {
      yield "a";
    })(),
    { kind: InputNormalizationMode.Iterable },
  );
  const first = input.step();
  assert(first instanceof Promise);
  assertEquals(unwrap((await first)?.value), "a");
  assertEquals(input.done(), false);
  const eof = (await input.next()).step();
  assert(eof instanceof Promise);
  assertEquals(await eof, undefined);
});
