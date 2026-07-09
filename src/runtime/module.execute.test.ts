import { assertEquals } from "@std/assert";
import { MatchKind } from "../match.ts";
import { executeModuleDeclaration } from "./module.execute.ts";
import { ExportDeclarationKind } from "./declarations/export.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { ExpressionKind } from "./expressions/expression.kind.ts";

Deno.test("runtime.module.execute executes default exported rule", async () => {
  const m = await executeModuleDeclaration(
    {
      imports: [],
      exports: [{
        kind: ExportDeclarationKind.Rule,
        name: "Main",
        default: true,
      }],
      rules: [{
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
      }],
    },
    { input: "x" },
  );

  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind === MatchKind.Ok) {
    assertEquals(m.value, "x");
  }
});

Deno.test("runtime.module.execute executes named exported rule", async () => {
  const m = await executeModuleDeclaration(
    {
      imports: [],
      exports: [{ kind: ExportDeclarationKind.Rule, name: "One" }],
      rules: [{
        name: "One",
        parameters: [],
        pattern: { kind: PatternKind.Any },
        expression: { kind: ExpressionKind.Number, value: 1 },
      }],
    },
    { input: "x", entryRuleName: "One" },
  );

  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind === MatchKind.Ok) {
    assertEquals(m.value, 1);
  }
});
