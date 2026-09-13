import { assertEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { uffdaGrammar } from "./uffda.lang.ts";

/**
 * Grammar-level coverage for `decorator Name<params> = expr;` declarations
 * (#159, reworked design). See
 * `.agents/specifications/languages/uffda-syntax/decorator-declarations.spec.md`
 * and `.agents/requirements/rule-decorators/001-decorator-declaration-syntax.requirement.md`.
 */
Deno.test("lang.uffda.decorator-rules", async (t) => {
  await t.step(
    "DECORATOR_RULES00 - a bare `decorator Name = expr;` parses as its own declaration kind",
    async () => {
      const match = await uffdaGrammar('decorator Example = "example";');
      assertEquals(match.kind, MatchKind.Ok);
      if (match.kind !== MatchKind.Ok) return;
      const declaration = match.value.declarations[0];
      assertEquals(declaration.kind, "decorator");
      if (declaration.kind !== "decorator") return;
      assertEquals(declaration.name, "Example");
      assertEquals(declaration.pattern, { kind: PatternKind.End });
    },
  );

  await t.step(
    "DECORATOR_RULES01 - a decorator declaration MAY declare a parameter list",
    async () => {
      const match = await uffdaGrammar(
        "decorator Deprecated<message:string> = message;",
      );
      assertEquals(match.kind, MatchKind.Ok);
      if (match.kind !== MatchKind.Ok) return;
      const declaration = match.value.declarations[0];
      assertEquals(declaration.kind, "decorator");
      if (declaration.kind !== "decorator") return;
      assertEquals(declaration.name, "Deprecated");
    },
  );

  await t.step(
    "DECORATOR_RULES02 - `export decorator Name = expr;` exports inline",
    async () => {
      const match = await uffdaGrammar('export decorator Example = "example";');
      assertEquals(match.kind, MatchKind.Ok);
      if (match.kind !== MatchKind.Ok) return;
      const decl = match.value.declarations.find((d) => d.kind === "decorator");
      const exportDecl = match.value.declarations.find((d) =>
        d.kind === "export"
      );
      assertEquals(decl?.kind, "decorator");
      assertEquals(exportDecl, { kind: "export", name: "Example" });
    },
  );

  await t.step(
    "DECORATOR_RULES03 - a decorator declaration MUST NOT itself carry an attribute list",
    async () => {
      const match = await uffdaGrammar("[Foo] decorator Bar = end;");
      assertEquals(match.kind, MatchKind.Fail);
    },
  );
});
