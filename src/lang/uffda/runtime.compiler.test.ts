import { assert, assertEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { lit } from "../../runtime/patterns/value_source.ts";
import type { UffdaSyntaxModule } from "./syntax.types.ts";
import {
  diagnoseUffdaRuntimeCompilerFailure,
  runUffdaRuntimeCompiler,
} from "./runtime.compiler.ts";
import { unwrap } from "../../wrapped.ts";
import { isSuccess, valueOf } from "../../match.ts";
import { uffdaGrammar } from "./uffda.lang.ts";

Deno.test("lang.uffda.runtime-compiler compiles an empty syntax module", async () => {
  const match = await runUffdaRuntimeCompiler({
    kind: "module",
    declarations: [],
  });

  assertEquals(match.kind, MatchKind.Ok);
  if (match.kind === MatchKind.Ok) {
    assertEquals(unwrap(match.value), {
      imports: [],
      exports: [],
      rules: [],
      funcs: [],
      decorators: [],
    });
  }
});

Deno.test("lang.uffda.runtime-compiler compiles declaration families", async () => {
  const syntaxModule: UffdaSyntaxModule = {
    kind: "module",
    declarations: [
      {
        kind: "import",
        moduleUrl: "./symbols.ts",
        names: ["Letter", "Space"],
      },
      {
        kind: "export",
        name: "Main",
      },
      {
        kind: "rule",
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
        projection: { kind: ExpressionKind.Value, value: "compiled" },
        attributes: [],
      },
      {
        kind: "rule",
        name: "Stop",
        parameters: [],
        pattern: { kind: PatternKind.Equal, value: lit(".") },
        attributes: [],
      },
    ],
  };

  const match = await runUffdaRuntimeCompiler(syntaxModule);

  assertEquals(match.kind, MatchKind.Ok);
  if (match.kind === MatchKind.Ok) {
    assertEquals(unwrap(match.value), {
      imports: [{
        kind: ImportDeclarationKind.Module,
        moduleUrl: "./symbols.ts",
        names: ["Letter", "Space"],
      }],
      exports: [{
        kind: ExportDeclarationKind.Rule,
        name: "Main",
      }],
      rules: [{
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
        expression: { kind: ExpressionKind.Value, value: "compiled" },
        attributes: [],
      }, {
        name: "Stop",
        parameters: [],
        pattern: { kind: PatternKind.Equal, value: lit(".") },
        expression: undefined,
        attributes: [],
      }],
      funcs: [],
      decorators: [],
    });
  }
});

Deno.test("lang.uffda.runtime-compiler drops comment nodes", async () => {
  const rule: UffdaSyntaxModule["declarations"][number] = {
    kind: "rule",
    name: "Main",
    parameters: [],
    pattern: { kind: PatternKind.Any },
    attributes: [],
  };
  const withComments = await runUffdaRuntimeCompiler({
    kind: "module",
    declarations: [
      {
        kind: "comment",
        blocks: [{
          kind: "paragraph",
          inlines: [{ kind: "text", text: "head" }],
        }],
      },
      { kind: "export", name: "Main" },
      {
        kind: "comment",
        blocks: [{
          kind: "paragraph",
          inlines: [{ kind: "text", text: "between" }],
        }],
      },
      rule,
      {
        kind: "comment",
        blocks: [{
          kind: "paragraph",
          inlines: [{ kind: "text", text: "tail" }],
        }],
      },
    ],
  });
  const withoutComments = await runUffdaRuntimeCompiler({
    kind: "module",
    declarations: [{ kind: "export", name: "Main" }, rule],
  });

  assertEquals(withComments.kind, MatchKind.Ok);
  assertEquals(withoutComments.kind, MatchKind.Ok);
  if (
    withComments.kind === MatchKind.Ok && withoutComments.kind === MatchKind.Ok
  ) {
    assertEquals(unwrap(withComments.value), unwrap(withoutComments.value));
  }
});

Deno.test(
  "lang.uffda.runtime-compiler re-exports imports as ExportDeclarationKind.Import",
  async () => {
    const syntaxModule: UffdaSyntaxModule = {
      kind: "module",
      declarations: [
        {
          kind: "import",
          moduleUrl: "./digit.uff",
          names: ["Digit"],
        },
        {
          kind: "export",
          name: "Digit",
        },
      ],
    };

    const match = await runUffdaRuntimeCompiler(syntaxModule);
    assertEquals(match.kind, MatchKind.Ok);
    if (match.kind === MatchKind.Ok) {
      assertEquals(unwrap(match.value), {
        imports: [{
          kind: ImportDeclarationKind.Module,
          moduleUrl: "./digit.uff",
          names: ["Digit"],
        }],
        exports: [{
          kind: ExportDeclarationKind.Import,
          name: "Digit",
        }],
        rules: [],
        funcs: [],
        decorators: [],
      });
    }
  },
);

Deno.test(
  "lang.uffda.runtime-compiler compiles decorator declarations",
  async () => {
    const syntaxModule: UffdaSyntaxModule = {
      kind: "module",
      declarations: [
        {
          kind: "export",
          name: "Deprecated",
        },
        {
          kind: "decorator",
          name: "Deprecated",
          pattern: { kind: PatternKind.End },
          expression: { kind: ExpressionKind.Value, value: "deprecated" },
          attributes: [{ kind: "attribute", name: "Deprecated", args: [] }],
        },
      ],
    };

    const match = await runUffdaRuntimeCompiler(syntaxModule);
    assertEquals(match.kind, MatchKind.Ok);
    if (match.kind === MatchKind.Ok) {
      assertEquals(unwrap(match.value), {
        imports: [],
        exports: [{
          kind: ExportDeclarationKind.Decorator,
          name: "Deprecated",
        }],
        rules: [],
        funcs: [],
        decorators: [{
          name: "Deprecated",
          pattern: { kind: PatternKind.End },
          expression: { kind: ExpressionKind.Value, value: "deprecated" },
          attributes: [{ name: "Deprecated", args: [] }],
        }],
      });
    }
  },
);

Deno.test("lang.uffda.runtime-compiler rejects unsupported declarations", async () => {
  const match = await runUffdaRuntimeCompiler({
    kind: "module",
    declarations: [{ kind: "unsupported" } as never],
  });

  assertEquals(match.kind, MatchKind.Fail);
  assertEquals(diagnoseUffdaRuntimeCompilerFailure(match), {
    matchKind: MatchKind.Fail,
    compilerRule: "CompileDeclaration",
    sourcePath: '[0]."declarations".[0].[0]',
  });
});

Deno.test("lang.uffda.runtime-compiler rejects malformed module input", async (t) => {
  await t.step("rejects a different AST kind", async () => {
    const match = await runUffdaRuntimeCompiler({
      kind: "rule",
      declarations: [],
    } as never);
    assertEquals(match.kind, MatchKind.Fail);
  });

  await t.step("rejects a non-object module shape", async () => {
    const match = await runUffdaRuntimeCompiler("not-a-module" as never);
    assertEquals(
      match.kind === MatchKind.Fail || match.kind === MatchKind.Error,
      true,
    );
  });
});

Deno.test("lang.uffda.runtime-compiler drops inner comments", async (t) => {
  const compile = async (source: string) => {
    const parsed = await uffdaGrammar(source);
    assert(isSuccess(parsed));
    const match = await runUffdaRuntimeCompiler(
      unwrap(valueOf(parsed)) as UffdaSyntaxModule,
    );
    assert(isSuccess(match));
    return unwrap(valueOf(match));
  };
  const cases = [
    {
      name: "collapses an or left with one alternative",
      commented: "rule A =\n  # a\n  | a\n  # | b\n;",
      plain: "rule A = a;",
    },
    {
      name: "keeps an or with alternatives left",
      commented: "rule A =\n  | a\n  # b\n  | c\n  # d\n;",
      plain: "rule A = a | c;",
    },
    {
      name: "drops comments between then, and and pipeline members",
      commented:
        "rule A =\n  a\n  # c\n  b\n;\nrule B =\n  x\n  # c\n  & y\n;\nrule C =\n  |> p\n  # c\n  |> q\n;",
      plain: "rule A = a b;\nrule B = x & y;\nrule C = |> p |> q;",
    },
    {
      name: "drops comments in projections and func bodies",
      commented:
        "rule A = x:any -> {\n  # k\n  a: [\n    # e\n    x\n  ],\n  b: (f\n    # arg\n    x)\n};\nfunc F<x> = [\n  # e\n  x\n];",
      plain: "rule A = x:any -> { a: [x], b: (f x) };\nfunc F<x> = [x];",
    },
  ];
  for (const c of cases) {
    await t.step(c.name, async () => {
      assertEquals(await compile(c.commented), await compile(c.plain));
    });
  }
});
