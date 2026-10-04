import { assert, assertEquals } from "@std/assert";
import { Input } from "../input.ts";
import { parseGrammar } from "../lang/grammar.ts";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import {
  CompletionContextKind,
  completionContextsAt,
} from "./lsp.completion_context.ts";

async function contextsAtEnd(prefix: string) {
  const input = Input.From(prefix, { open: true });
  return completionContextsAt(await uffdaGrammar(prefix, { input }), prefix);
}

async function onlyContextAtEnd(prefix: string) {
  const contexts = await contextsAtEnd(prefix);
  assertEquals(contexts.length, 1, JSON.stringify(contexts));
  return contexts[0];
}

Deno.test("cli.lsp.completion_context completionContextsAt", async (t) => {
  await t.step("a module path being typed", async () => {
    const prefix = 'import "../lib/fo';
    const context = await onlyContextAtEnd(prefix);
    assert(context.kind === CompletionContextKind.ModulePath);
    assertEquals(context.typed, "../lib/fo");
    assertEquals(context.extensions, [".uff"]);
    assertEquals(prefix.slice(context.replace.start), "fo");
    assertEquals(context.replace.end, prefix.length);
  });

  await t.step(
    "a module path typed partway, ending in a separator",
    async () => {
      for (const typed of ["./", "../", "../../", "./lib/", "@acme/"]) {
        const prefix = `import "${typed}`;
        const context = await onlyContextAtEnd(prefix);
        assert(context.kind === CompletionContextKind.ModulePath);
        assertEquals(context.typed, typed);
        assertEquals(context.replace, {
          start: prefix.length,
          end: prefix.length,
        });
      }
    },
  );

  await t.step("an empty module path right after its delimiter", async () => {
    const context = await onlyContextAtEnd('import "');
    assert(context.kind === CompletionContextKind.ModulePath);
    assertEquals(context.typed, "");
  });

  await t.step("an imported name being typed", async () => {
    const prefix = 'import "./dep.uff" Foo Ba';
    const context = await onlyContextAtEnd(prefix);
    assert(context.kind === CompletionContextKind.ImportedName);
    assertEquals(context.modulePath, "./dep.uff");
    assertEquals(context.listed, ["Foo"]);
    assertEquals(prefix.slice(context.replace.start), "Ba");
  });

  await t.step("an expected imported name after trivia", async () => {
    const prefix = 'import "./dep.uff" ';
    const context = await onlyContextAtEnd(prefix);
    assert(context.kind === CompletionContextKind.ImportedName);
    assertEquals(context.listed, []);
    assertEquals(context.replace, {
      start: prefix.length,
      end: prefix.length,
    });
  });

  await t.step("a rule reference in a pattern", async () => {
    const prefix = 'import "./a.uff" A;\nrule X = Fo';
    const context = await onlyContextAtEnd(prefix);
    assert(context.kind === CompletionContextKind.NameReference);
    assertEquals(context.kinds, ["rule"]);
    assertEquals(prefix.slice(context.replace.start), "Fo");
  });

  await t.step("a func reference in an expression", async () => {
    const context = await onlyContextAtEnd("rule X = a -> (fo");
    assert(context.kind === CompletionContextKind.NameReference);
    assertEquals(context.kinds, ["func"]);
  });

  await t.step(
    "a func reference carries the variables in scope",
    async () => {
      const locals = async (prefix: string) => {
        const context = await onlyContextAtEnd(prefix);
        assert(context.kind === CompletionContextKind.NameReference);
        return context.locals.map((binding) => binding.name);
      };
      assertEquals(await locals("rule X = y:A -> (f y"), ["y"]);
      assertEquals(
        await locals("rule X = y:A -> (map [y] <z:any> -> (add z"),
        ["y", "z"],
      );
      assertEquals(
        await locals(
          "rule X = y:A -> (map (map [y] <z:any> -> z) <w:any> -> w",
        ),
        ["w", "y"],
      );
      assertEquals(await locals("func F<{text: t:string}> = (f t"), ["t"]);
    },
  );

  await t.step(
    "a rule reference carries the rule's parameters, not variables",
    async () => {
      const context = await onlyContextAtEnd("rule Pair<P, Q> = a:P b:Q");
      assert(context.kind === CompletionContextKind.NameReference);
      assertEquals(context.locals.map((binding) => binding.name), ["P", "Q"]);
    },
  );

  await t.step(
    "an empty position after an optional repetition",
    async () => {
      const argument = await onlyContextAtEnd("rule X = y:A -> (f ");
      assert(argument.kind === CompletionContextKind.NameReference);
      assertEquals(argument.kinds, ["func"]);
      assertEquals(argument.locals.map((binding) => binding.name), ["y"]);

      const prefix = 'import "./dep.uff" Foo ';
      const name = await onlyContextAtEnd(prefix);
      assert(name.kind === CompletionContextKind.ImportedName);
      assertEquals(name.listed, ["Foo"]);
      assertEquals(name.replace, { start: prefix.length, end: prefix.length });

      const next = await onlyContextAtEnd("rule X = a ");
      assert(next.kind === CompletionContextKind.NameReference);
      assertEquals(next.kinds, ["rule"]);
    },
  );

  await t.step(
    "the token being typed wins over tokens expected after it",
    async () => {
      const prefix = 'import "./dep.uff" Foo Ba';
      const context = await onlyContextAtEnd(prefix);
      assert(context.kind === CompletionContextKind.ImportedName);
      assertEquals(prefix.slice(context.replace.start), "Ba");
    },
  );

  await t.step("the outermost NameReference wins", async () => {
    const context = await onlyContextAtEnd("[De");
    assert(context.kind === CompletionContextKind.NameReference);
    assertEquals(context.kinds, ["decorator"]);
  });

  await t.step("an expected reference after an operator", async () => {
    const prefix = "rule X = a | ";
    const context = await onlyContextAtEnd(prefix);
    assert(context.kind === CompletionContextKind.NameReference);
    assertEquals(context.replace.start, prefix.length);
  });

  await t.step("no context outside annotated productions", async () => {
    assertEquals(await contextsAtEnd('rule A = "x'), []);
    assertEquals(await contextsAtEnd('import "./dep.uff" Foo;'), []);
    assertEquals(await contextsAtEnd(""), []);
  });

  await t.step(
    "no context from a grammar without context metadata",
    async () => {
      const prefix = 'import "./dep.uff" Fo';
      const match = await parseGrammar({
        source: prefix,
        moduleUrl: new URL("../lang/tokenizer/mod.uff", import.meta.url),
        entryRuleName: "Tokenizer",
      });
      assertEquals(completionContextsAt(match, prefix), []);
    },
  );
});
