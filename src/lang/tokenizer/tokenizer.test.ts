import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./mod.ts", import.meta.url).href;

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
      input: Input.From(""),
      value: [],
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "TOKENIZER01",
    ignore: p.state !== "granted",
    fn: moduleDeclarationTest({
      moduleUrl,
      input: Input.From(" "),
      value: [
        { kind: "whitespace", value: " " },
      ],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "TOKENIZER02",
    ignore: p.state !== "granted",
    fn: moduleDeclarationTest({
      moduleUrl,
      input: Input.From(" \n "),
      value: [
        { kind: "whitespace", value: " " },
        { kind: "newline", value: "\n" },
        { kind: "whitespace", value: " " },
      ],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "TOKENIZER03",
    ignore: p.state !== "granted",
    fn: moduleDeclarationTest({
      moduleUrl,
      input: Input.From("abc\nxyz"),
      value: [
        { kind: "identifier", value: "abc" },
        { kind: "newline", value: "\n" },
        { kind: "identifier", value: "xyz" },
      ],
      kind: MatchKind.Ok,
    }),
  });
});
