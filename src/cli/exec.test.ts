import { assertEquals } from "@std/assert";
import { join, toFileUrl } from "@std/path";
import { expressionGrammar } from "../lang/expression/expression.lang.ts";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import { MatchKind } from "../match.ts";
import { compileSourcesToAstArtifacts } from "./compile.ts";
import {
  CliExecFailureCode,
  executeCliAst,
  executeCliExpression,
  executeCliModule,
  moduleUrlForCliOrigin,
  parseCliAst,
} from "./exec.ts";

Deno.test("cli.exec executes raw module and expression AST inputs", async (t) => {
  await t.step("executes a raw Uffda module AST", async () => {
    const parsed = await uffdaGrammar("export Main; rule Main = ok -> 1;");
    assertEquals(parsed.kind, MatchKind.Ok);
    if (parsed.kind !== MatchKind.Ok) return;

    const result = await executeCliAst(parsed.value);
    assertEquals(result, { ok: true, value: 1 });
  });

  await t.step("executes a raw expression AST with echo", async () => {
    const parsed = await expressionGrammar('(echo "hello")');
    assertEquals(parsed.kind, MatchKind.Ok);
    if (parsed.kind !== MatchKind.Ok) return;

    const result = await executeCliExpression(parsed.value);
    assertEquals(result, { ok: true, value: "hello" });
  });

  await t.step("runs a raw Uffda module AST by entry rule", async () => {
    const parsed = await uffdaGrammar(
      "export Main; export Other; rule Main = ok -> 1; rule Other = ok -> 2;",
    );
    assertEquals(parsed.kind, MatchKind.Ok);
    if (parsed.kind !== MatchKind.Ok) return;

    const result = await executeCliModule(parsed.value, "Other");
    assertEquals(result, { ok: true, value: 2 });
  });

  await t.step("rejects malformed AST input", async () => {
    const result = await executeCliAst({ kind: "or" });
    assertEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.error.code, CliExecFailureCode.UnsupportedAst);
  });

  await t.step("reports invalid JSON", () => {
    const result = parseCliAst("{");
    assertEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.error.code, CliExecFailureCode.InvalidJson);
  });

  await t.step(
    "moduleUrlForCliOrigin distinguishes file, stdin, and eval",
    () => {
      assertEquals(
        moduleUrlForCliOrigin("/repo", { kind: "stdin" }).href,
        toFileUrl("/repo/__stdin__.uff").href,
      );
      assertEquals(
        moduleUrlForCliOrigin("/repo", { kind: "eval" }).href,
        toFileUrl("/repo/__eval__.uff").href,
      );
      assertEquals(
        moduleUrlForCliOrigin("/repo", {
          kind: "file",
          absolutePath: "/repo/src/main.uff",
        }).href,
        toFileUrl("/repo/src/main.uff").href,
      );
    },
  );

  await t.step("moduleUrlForCliOrigin rejects relative file paths", () => {
    let threw = false;
    try {
      moduleUrlForCliOrigin("/repo", {
        kind: "file",
        absolutePath: "src/main.uff",
      });
    } catch (error) {
      threw = error instanceof TypeError;
    }
    assertEquals(threw, true);
  });

  await t.step(
    "executeCliModule resolves relative .uff imports via artifactRoot",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-cli-exec-uff-" });
      const artifactRoot = join(cwd, "bin");
      try {
        const leafPath = join(cwd, "leaf.uff");
        const rootPath = join(cwd, "root.uff");
        await Deno.writeTextFile(leafPath, "export rule Leaf = ok -> 7;\n");
        await Deno.writeTextFile(
          rootPath,
          `import "./leaf.uff" Leaf;\nexport rule Root = Leaf;\n`,
        );

        const compiled = await compileSourcesToAstArtifacts({
          cwd,
          sourcePaths: [leafPath, rootPath],
          outputDir: join(artifactRoot, "ast"),
          overwrite: true,
        });
        assertEquals(compiled.ok, true, JSON.stringify(compiled.failures));

        const parsed = await uffdaGrammar(await Deno.readTextFile(rootPath));
        assertEquals(parsed.kind, MatchKind.Ok);
        if (parsed.kind !== MatchKind.Ok) return;

        const result = await executeCliModule(parsed.value, "Root", {
          cwd,
          artifactRoot,
          moduleUrl: moduleUrlForCliOrigin(cwd, {
            kind: "file",
            absolutePath: rootPath,
          }),
        });
        assertEquals(result, { ok: true, value: 7 });
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );
});
