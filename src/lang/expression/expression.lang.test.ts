import { MatchKind, Resolver } from "../../mod.ts";
import { expressionGrammar } from "./expression.lang.ts";
import { assertEquals, assertStringIncludes } from "@std/assert";
import { defaultGlobals } from "../../runtime/globals/mod.ts";
import { exec } from "../../runtime/exec.ts";
import type { Expression } from "../../runtime/expressions/expression.ts";
import { visualizeMatchFailure } from "../../match.visualize.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { Scope } from "../../runtime/scope.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";
import { resolve } from "../../runtime/patterns/resolve.ts";

const moduleUrl = new URL("./expression.lang.uff", import.meta.url);

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl.href,
});

async function runExpressionLangRule(
  entryRuleName: string,
  input: Iterable<unknown>,
) {
  const resolver = new Resolver({
    cwd: Deno.cwd(),
    artifactRoot: `${Deno.cwd()}/bin`,
  });
  const scope = Scope.From(input).withOptions({ resolver });
  const imported = await resolver.import(moduleUrl, {
    scope,
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: entryRuleName,
    },
  });
  if (imported.kind === ModuleImportResultKind.Error) {
    throw imported.error;
  }
  return await resolve(
    {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: entryRuleName,
    },
    scope.pushModule(imported.module),
  );
}

Deno.test(
  {
    name: "lang.expression",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step("EXPR_TOKENS_00 parses an existing token array", async () => {
      const m = await runExpressionLangRule("ExpressionTokens", [
        "[",
        "1",
        "2",
        "]",
      ]);
      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind === MatchKind.Ok) {
        const value = await exec(m.value as Expression, m);
        assertEquals(value, [1, 2]);
      }
    });

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
          ...defaultGlobals,
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
          ...defaultGlobals,
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

    await t.step({
      name: "EXPR_LANG_08 visualizes the unexpected expression token",
      fn: async () => {
        const m = await expressionGrammar("(add 1 #)");
        assertEquals(m.kind, MatchKind.Fail);

        const visualization = await visualizeMatchFailure(m);
        assertStringIncludes(visualization, 'Unexpected: "#"');
        assertStringIncludes(visualization, "source offset 7");
        assertStringIncludes(
          visualization,
          "[2] OK into -> resolve TokenizerNoWhitespace",
        );
        assertStringIncludes(visualization, 'output: [ "(", "add", "1" ]');
        assertStringIncludes(
          visualization,
          "[3] FAIL into -> resolve ExpressionComplete",
        );
        assertStringIncludes(visualization, "expression.lang.uff");
        assertStringIncludes(visualization, "Failure tree:");
      },
    });

    await t.step({
      name: "EXPR_LANG_09 lambda invoked inline with a single parameter",
      fn: async () => {
        const m = await expressionGrammar("(<x:any> -> (add x 1) 5)");
        switch (m.kind) {
          case MatchKind.Ok: {
            const value = await exec(m.value, m);
            assertEquals(value, 6);
            break;
          }
          default:
            assertEquals(m.kind, MatchKind.Ok);
        }
      },
    });

    await t.step({
      name: "EXPR_LANG_10 lambda invoked inline with multiple parameters",
      fn: async () => {
        const m = await expressionGrammar("(<a:any b:any> -> (add a b) 2 3)");
        switch (m.kind) {
          case MatchKind.Ok: {
            const value = await exec(m.value, m);
            assertEquals(value, 5);
            break;
          }
          default:
            assertEquals(m.kind, MatchKind.Ok);
        }
      },
    });

    await t.step({
      name: "EXPR_LANG_11 lambda body may be a bare reference, no parens",
      fn: async () => {
        const m = await expressionGrammar("(<x:any> -> x 9)");
        switch (m.kind) {
          case MatchKind.Ok: {
            const value = await exec(m.value, m);
            assertEquals(value, 9);
            break;
          }
          default:
            assertEquals(m.kind, MatchKind.Ok);
        }
      },
    });

    await t.step({
      name: "EXPR_LANG_12 reduce composes with an inline lambda",
      fn: async () => {
        const m = await expressionGrammar(
          "(reduce [1 2 3 4] 0 <acc:any x:any> -> (add acc x))",
        );
        switch (m.kind) {
          case MatchKind.Ok: {
            const value = await exec(m.value, m);
            assertEquals(value, 10);
            break;
          }
          default:
            assertEquals(m.kind, MatchKind.Ok);
        }
      },
    });
  },
);
