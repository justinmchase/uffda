import { MatchKind } from "../../mod.ts";
import { expr } from "./expression.lang.ts";
import { assertEquals } from "@std/assert";

const moduleUrl = new URL("./binary.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

// This test now works with the Insignificant whitespace filter
// that removes whitespace from the tokenizer output.
Deno.test(
  {
    name: "lang.expression",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "EXPR_LANG_00",
      fn: async () => {
        const m = await expr("(add 1 2)");
        switch (m.kind) {
          case MatchKind.Ok: {
            assertEquals(m.value, 3);
            break;
          }
          case MatchKind.Fail:
            console.log(Deno.inspect({
              start: m.span.start.toString(),
              end: m.span.end.toString(),
            }, { depth: 10, colors: true }));
            assertEquals(m.kind, MatchKind.Ok);
            break;
          default:
            console.log(m);
            assertEquals(m.kind, MatchKind.Ok);
        }
      },
    });
  },
);
