import { Input } from "../input.ts";
import { moduleDeclarationTest } from "../test.ts";

const moduleUrl = new URL("./tokenizer.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test("lang.tokenizer", async (t) => {
  await t.step({
    name: "TOKENIZER00",
    ignore: p.state !== "granted",
    fn: moduleDeclarationTest({
      moduleUrl,
      input: Input.From(" "),
      value: [" "],
    }),
  });
});
