import { assertEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { lit } from "../../runtime/patterns/value_source.ts";
import { uffdaGrammar } from "./uffda.lang.ts";

/**
 * Grammar-level coverage for `[Name]` / `[Name arg1 arg2]` attribute syntax
 * (#159). See `.agents/specifications/languages/uffda-syntax/declaration-attributes.spec.md`
 * and `.agents/requirements/rule-decorators/002-attribute-syntax-and-stacking.requirement.md`.
 */
Deno.test("lang.uffda.attribute-rules", async (t) => {
  await t.step(
    "ATTRIBUTE_RULES00 - a rule with no attributes has an empty attributes list",
    async () => {
      const match = await uffdaGrammar("rule Main = any;");
      assertEquals(match.kind, MatchKind.Ok);
      if (match.kind !== MatchKind.Ok) return;
      const declaration = match.value.declarations[0];
      assertEquals("attributes" in declaration && declaration.attributes, []);
    },
  );

  await t.step(
    "ATTRIBUTE_RULES01 - a bare `[Name]` attribute with no args parses",
    async () => {
      const match = await uffdaGrammar("[Foo] rule Main = any;");
      assertEquals(match.kind, MatchKind.Ok);
      if (match.kind !== MatchKind.Ok) return;
      const declaration = match.value.declarations[0];
      assertEquals(
        "attributes" in declaration && declaration.attributes,
        [{ kind: "attribute", name: "Foo", args: [] }],
      );
    },
  );

  await t.step(
    "ATTRIBUTE_RULES02 - `[Name arg1 arg2]` captures ordered argument expressions",
    async () => {
      const match = await uffdaGrammar('[Foo 1 "bar"] rule Main = any;');
      assertEquals(match.kind, MatchKind.Ok);
      if (match.kind !== MatchKind.Ok) return;
      const declaration = match.value.declarations[0];
      if (!("attributes" in declaration)) {
        throw new Error("expected attributes");
      }
      assertEquals(declaration.attributes.length, 1);
      assertEquals(declaration.attributes[0].name, "Foo");
      assertEquals(declaration.attributes[0].args.length, 2);
    },
  );

  await t.step(
    "ATTRIBUTE_RULES03 - stacked attributes `[Foo][Bar]` are captured in written order",
    async () => {
      const match = await uffdaGrammar("[Foo][Bar] rule Main = any;");
      assertEquals(match.kind, MatchKind.Ok);
      if (match.kind !== MatchKind.Ok) return;
      const declaration = match.value.declarations[0];
      assertEquals(
        "attributes" in declaration && declaration.attributes,
        [
          { kind: "attribute", name: "Foo", args: [] },
          { kind: "attribute", name: "Bar", args: [] },
        ],
      );
    },
  );

  await t.step(
    "ATTRIBUTE_RULES04 - a func declaration also captures leading attributes",
    async () => {
      const match = await uffdaGrammar("[Foo] func Main<a:any> = a;");
      assertEquals(match.kind, MatchKind.Ok);
      if (match.kind !== MatchKind.Ok) return;
      const declaration = match.value.declarations[0];
      assertEquals(declaration.kind, "func");
      assertEquals(
        "attributes" in declaration && declaration.attributes,
        [{ kind: "attribute", name: "Foo", args: [] }],
      );
    },
  );

  await t.step(
    "ATTRIBUTE_RULES05 - `export [Foo] rule X` supports attributes before the rule keyword",
    async () => {
      const match = await uffdaGrammar("export [Foo] rule Main = any;");
      assertEquals(match.kind, MatchKind.Ok);
      if (match.kind !== MatchKind.Ok) return;
      const declaration = match.value.declarations.find((d) =>
        d.kind === "rule"
      );
      if (!declaration || !("attributes" in declaration)) {
        throw new Error("expected a decorated rule declaration");
      }
      assertEquals(declaration.attributes, [
        { kind: "attribute", name: "Foo", args: [] },
      ]);
    },
  );

  await t.step(
    "ATTRIBUTE_RULES06 - a decorated rule pattern still parses (pattern unaffected)",
    async () => {
      const match = await uffdaGrammar('[Foo] rule Main = "." end;');
      assertEquals(match.kind, MatchKind.Ok);
      if (match.kind !== MatchKind.Ok) return;
      const declaration = match.value.declarations[0];
      if (declaration.kind !== "rule") throw new Error("expected rule");
      assertEquals(declaration.pattern, {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit(".") },
          { kind: PatternKind.End },
        ],
      });
    },
  );

  await t.step(
    "ATTRIBUTE_RULES07 - an attribute list before a decorator declaration fails to parse",
    async () => {
      const match = await uffdaGrammar("[Foo] decorator Bar = end;");
      assertEquals(match.kind, MatchKind.Fail);
    },
  );
});
