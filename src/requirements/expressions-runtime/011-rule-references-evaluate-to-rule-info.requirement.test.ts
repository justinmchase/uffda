import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind, valueOf } from "../../match.ts";
import { compileUffdaSource } from "../../lang/uffda/execute.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { Scope } from "../../runtime/scope.ts";
import { executeModuleDeclaration } from "../../runtime/module.execute.ts";
import { unwrap } from "../../wrapped.ts";

const mainUrl = new URL("file:///uffda/rule-info/main.uff.ts");
const formatUrl = new URL("file:///uffda/rule-info/format.uff.ts");

const format = `
export Print;
rule Print<W> = ok -> "printed";
`;

const main = `
import "./format.uff.ts" Print;
export Lang;
export Info;
export Shadow;
export Param;
export Json;

decorator Formatter<f:object> = f;

func Local = Lang;

[Formatter Print]
rule Lang = ok -> (Local);

rule Info = ok -> Print;
rule Shadow = Print:string -> Print;
rule Param<L> = ok -> L;
rule Json = ok -> (json Lang);
`;

async function compile(source: string) {
  const compiled = await compileUffdaSource(source);
  if (compiled.kind !== MatchKind.Ok) {
    throw new Error(`compile failed: ${compiled.kind}`);
  }
  return valueOf(compiled);
}

async function load() {
  const resolver = new Resolver({
    declarations: {
      [mainUrl.href]: await compile(main),
      [formatUrl.href]: await compile(format),
    },
  });
  const imported = await resolver.import(mainUrl, {
    scope: Scope.Default(),
    pattern: { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
  });
  if (imported.kind !== ModuleImportResultKind.Module) {
    throw new Error(`import failed: ${imported.kind}`);
  }
  return { resolver, module: imported.module };
}

const printInfo = {
  kind: "rule",
  name: "Print",
  moduleUrl: formatUrl.href,
  parameters: ["W"],
};

Deno.test(
  "req:expressions-runtime-011 - an attribute argument passes a rule's info to the decorator",
  async () => {
    const { module } = await load();
    assertEquals(module.rules.get("Lang")?.metadata, { Formatter: printInfo });
  },
);

Deno.test(
  "req:expressions-runtime-011 - rule names in projections and func bodies evaluate to rule info",
  async () => {
    const declarations = { [formatUrl.href]: await compile(format) };
    const declaration = await compile(main);
    const run = async (rule: string, input: unknown[] = []) => {
      const m = await executeModuleDeclaration(declaration, {
        moduleUrl: mainUrl,
        declarations,
        entryRuleName: rule,
        input: Input.Iterable(input),
      });
      return m.kind === MatchKind.Ok ? unwrap(valueOf(m)) : m;
    };
    assertEquals(await run("Info"), printInfo);
    assertEquals(await run("Lang"), {
      kind: "rule",
      name: "Lang",
      moduleUrl: mainUrl.href,
      parameters: [],
    });
    assertEquals(await run("Shadow", ["text"]), "text");
    const param = await run("Param");
    assertEquals((param as { kind: string }).kind, MatchKind.Error);
    assertEquals(
      JSON.parse(await run("Json") as string),
      { kind: "rule", name: "Lang", moduleUrl: mainUrl.href, parameters: [] },
    );
  },
);
