import { assertEquals } from "@std/assert";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import {
  acceptsKind,
  identifierPosition,
  localBindingAt,
  LocalBindingKind,
} from "./lsp.locals.ts";

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
