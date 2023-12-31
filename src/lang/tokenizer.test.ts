import { Input } from "../input.ts";
import { moduleDeclarationTest } from "../test.ts";

const moduleUrl = new URL("./tokenizer.ts", import.meta.url).href;

Deno.test("lang.tokenizer", async (t) => {
  await t.step({
    name: "TOKENIZER00",
    fn: moduleDeclarationTest({
      moduleUrl,
      input: Input.From(" "),
      value: [" "],
    }),
  });
});
