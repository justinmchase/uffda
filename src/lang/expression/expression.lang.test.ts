import { MatchKind } from "../../mod.ts";
import { expressionGrammar } from "./expression.lang.ts";
import { assertEquals } from "@std/assert";
import { std } from "../../runtime/std/mod.ts";
import { exec } from "../../runtime/exec.ts";

const moduleUrl = new URL("./expression.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.expression",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "EXPR_LANG_00",
      fn: async () => {
        const m = await expressionGrammar("(add 1 2)");
        switch (m.kind) {
          case MatchKind.Ok: {
            const value = await exec(m.value, m);
            assertEquals(value, 3);
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

    await t.step({
      name: "EXPR_LANG_01",
      fn: async () => {
        const m = await expressionGrammar("( add   1   2 )");
        switch (m.kind) {
          case MatchKind.Ok: {
            const value = await exec(m.value, m);
            assertEquals(value, 3);
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

    await t.step({
      name: "EXPR_LANG_02",
      fn: async () => {
        const m = await expressionGrammar("(coalesce null 7)");
        switch (m.kind) {
          case MatchKind.Ok: {
            const value = await exec(m.value, m);
            assertEquals(value, 7);
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

    await t.step({
      name: "EXPR_LANG_03",
      fn: async () => {
        const m = await expressionGrammar("[1 2 true null]");
        switch (m.kind) {
          case MatchKind.Ok: {
            const value = await exec(m.value, m);
            assertEquals(value, [1, 2, true, null]);
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

    await t.step({
      name: "EXPR_LANG_04",
      fn: async () => {
        const m = await expressionGrammar(
          "{name: 1, enabled: true, fallback: undefined}",
        );
        switch (m.kind) {
          case MatchKind.Ok: {
            const value = await exec(m.value, m);
            assertEquals(value, {
              name: 1,
              enabled: true,
              fallback: undefined,
            });
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

    await t.step({
      name: "EXPR_LANG_05",
      fn: async () => {
        const globals = new Map<string, unknown>([
          ...std,
          ["xs", [2, 3]],
        ]);
        const m = await expressionGrammar("[1 ...xs]", { globals });
        switch (m.kind) {
          case MatchKind.Ok: {
            const value = await exec(m.value, m);
            assertEquals(value, [1, 2, 3]);
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

    await t.step({
      name: "EXPR_LANG_06",
      fn: async () => {
        const globals = new Map<string, unknown>([
          ...std,
          ["base", { enabled: true }],
        ]);
        const m = await expressionGrammar("{...base, count: 1}", { globals });
        switch (m.kind) {
          case MatchKind.Ok: {
            const value = await exec(m.value, m);
            assertEquals(value, { enabled: true, count: 1 });
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

    await t.step({
      name: "EXPR_LANG_07",
      fn: async () => {
        const m = await expressionGrammar("(add 1 2) trailing");
        assertEquals(m.kind, MatchKind.Fail);
      },
    });
  },
);
