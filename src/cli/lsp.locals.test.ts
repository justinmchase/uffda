import { assertEquals } from "@std/assert";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import { EditorDecorator, hasEditorMetadata } from "./editor_metadata.ts";
import {
  acceptsKind,
  identifierPosition,
  identifierPositions,
  localBindingAt,
  LocalBindingKind,
  localBindingsAt,
  LocalScopeMemo,
} from "./lsp.locals.ts";

Deno.test("cli.lsp.locals identifierPositions", async (t) => {
  const source = `rule Pair<P> = a:P b:P -> [a b];
rule Main = n:string -> (join (map [n] <x:any> -> (f x n)) ",");`;
  const match = await uffdaGrammar(source);
  const spans = [...source.matchAll(/\b[a-zA-Z]\w*\b/g)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }));

  await t.step("matches identifierPosition for every span", () => {
    const batch = identifierPositions(match, spans);
    spans.forEach((span, i) => {
      assertEquals(batch[i], identifierPosition(match, span));
    });
  });

  await t.step("a memo does not change the bindings found", () => {
    const memo = new LocalScopeMemo();
    for (const position of identifierPositions(match, spans)) {
      assertEquals(localBindingsAt(position, memo), localBindingsAt(position));
    }
    assertEquals(memo.variables.size > 0, true);
  });

  await t.step(
    "a later pipeline stage outranks a deeper earlier one",
    async () => {
      const source = `import "./dep.uff" Dep;\nrule Main = Dep;`;
      const match = await uffdaGrammar(source);
      const start = source.indexOf("Dep;");
      const [position] = identifierPositions(match, [{
        start,
        end: start + 3,
      }]);
      assertEquals(
        position.chain.some((node) =>
          hasEditorMetadata(node, EditorDecorator.ImportedName)
        ),
        true,
      );
    },
  );
});

async function bindingAt(source: string, needle: string, delta = 0) {
  const match = await uffdaGrammar(source);
  const start = source.indexOf(needle) + delta;
  const name = source.slice(start).match(/^\w+/)?.[0] ?? "";
  const position = identifierPosition(match, {
    start,
    end: start + name.length,
  });
  const binding = localBindingAt(position, name);
  return binding?.kind === LocalBindingKind.Variable
    ? { ...binding, text: source.slice(binding.span.start, binding.span.end) }
    : binding;
}

Deno.test("cli.lsp.locals", async (t) => {
  await t.step("resolves a captured variable in a projection", async () => {
    const source = "rule Main = n:string -> (json n);";
    const binding = await bindingAt(source, "n)");
    assertEquals(binding?.kind, LocalBindingKind.Variable);
    assertEquals(
      binding && "text" in binding ? binding.text : undefined,
      "n:string",
    );
  });

  await t.step("names the declaration that binds a variable", async () => {
    const source = "func F<s:string> = (map [s] <x:any> -> x);";
    const direct = await bindingAt(source, "[s]", 1);
    assertEquals(
      direct && "declarationName" in direct ? direct.declarationName : null,
      "F",
    );
    const lambda = await bindingAt(source, "-> x", 3);
    assertEquals(
      lambda && "declarationName" in lambda ? lambda.declarationName : null,
      null,
    );
  });

  await t.step("resolves destructured func parameters", async () => {
    const source = "func Text<{text: t:string}> = t;";
    const binding = await bindingAt(source, "t;");
    assertEquals(
      binding && "text" in binding ? binding.text : undefined,
      "t:string",
    );
  });

  await t.step("scopes lambda parameters to their lambda", async () => {
    const source = "rule Main = x:any -> (map [x] <x:any> -> x);";
    const inner = await bindingAt(source, "-> x)", 3);
    const outer = await bindingAt(source, "[x]", 1);
    assertEquals(
      inner && "span" in inner ? inner.span.start : undefined,
      source.indexOf("<x:any>") + 1,
    );
    assertEquals(
      outer && "span" in outer ? outer.span.start : undefined,
      source.indexOf("x:any"),
    );
  });

  await t.step(
    "resolves rule parameters only as pattern references",
    async () => {
      const source = "rule Pair<P> = a:P -> (json P);";
      assertEquals(await bindingAt(source, "a:P", 2), {
        kind: LocalBindingKind.Parameter,
        name: "P",
        declarationName: "Pair",
      });
      assertEquals(await bindingAt(source, "P)"), undefined);
    },
  );

  await t.step("does not see bindings of another declaration", async () => {
    const source = "rule A = n:string;\nrule B = any -> (json n);";
    assertEquals(await bindingAt(source, "n)"), undefined);
  });

  await t.step(
    "lists every visible binding, inner scopes first and shadowing",
    async () => {
      const source =
        "rule Pair<P> = x:P y:P -> (map [x] <{v: x:any}> -> (f x y));";
      const match = await uffdaGrammar(source);
      const start = source.indexOf("x y)");
      const position = identifierPosition(match, { start, end: start + 1 });
      const bindings = localBindingsAt(position);
      assertEquals(bindings.map((b) => `${b.kind}:${b.name}`), [
        "variable:x",
        "variable:y",
      ]);
      const [inner] = bindings;
      assertEquals(
        inner.kind === LocalBindingKind.Variable
          ? source.slice(inner.span.start, inner.span.end)
          : undefined,
        "x:any",
      );
    },
  );

  await t.step(
    "lists a rule's [Parameter] names at a rule reference",
    async () => {
      const source = "rule Pair<P, Q> = a:P b:Q;";
      const match = await uffdaGrammar(source);
      const start = source.indexOf("Q;");
      const position = identifierPosition(match, { start, end: start + 1 });
      assertEquals(
        localBindingsAt(position).map((b) => `${b.kind}:${b.name}`),
        ["parameter:P", "parameter:Q"],
      );
    },
  );

  await t.step("acceptsKind follows the covering NameReference", async () => {
    const source = "rule Main = Other -> (json _);";
    const match = await uffdaGrammar(source);
    const at = (needle: string, length: number) => {
      const start = source.indexOf(needle);
      return identifierPosition(match, { start, end: start + length });
    };
    const pattern = at("Other", 5);
    assertEquals(acceptsKind(pattern, "rule"), true);
    assertEquals(acceptsKind(pattern, "func"), false);
    const expression = at("json", 4);
    assertEquals(acceptsKind(expression, "func"), true);
    assertEquals(acceptsKind(expression, "rule"), false);
    const binding = at("Main", 4);
    assertEquals(binding.reference, undefined);
    assertEquals(acceptsKind(binding, "rule"), true);
  });
});
