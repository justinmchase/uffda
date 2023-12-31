import { Input } from "../../input.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./whitespace.ts", import.meta.url).href;

Deno.test("lang.common.whitespace", async (t) => {
  await t.step({
    name: "WHITESPACE00",
    fn: moduleDeclarationTest({
      moduleUrl,
      input: Input.From(" "),
      value: " ",
    }),
  });

  await t.step({
    name: "WHITESPACE01",
    fn: moduleDeclarationTest({
      moduleUrl,
      input: Input.From(" \t "),
      value: " \t ",
    }),
  });

  await t.step({
    name: "WHITESPACE02",
    fn: moduleDeclarationTest({
      moduleUrl,
      input: Input.From(""),
      matched: false,
    }),
  });

  await t.step({
    name: "WHITESPACE03",
    fn: moduleDeclarationTest({
      moduleUrl,
      input: Input.From("\r"),
      matched: false,
      done: false,
    }),
  });

  await t.step({
    name: "WHITESPACE03",
    fn: moduleDeclarationTest({
      moduleUrl,
      input: Input.From("\n"),
      matched: false,
      done: false,
    }),
  });
});
