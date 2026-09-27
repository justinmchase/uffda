import { assert, assertEquals } from "@std/assert";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import { MatchKind } from "../match.ts";
import {
  type AnnotatableMatch,
  declaredName,
  documentationOf,
  EditorDecorator,
  editorMetadata,
  findAnnotated,
  hasEditorMetadata,
  modulePathExtensions,
  nameReferenceKinds,
  nodeText,
  walkAnnotatable,
} from "./editor_metadata.ts";

const SOURCE = 'import "./a.uff" A;\nexport X;\nrule X = A -> (f _);';

function annotated(
  root: Parameters<typeof walkAnnotatable>[0],
  decorator: EditorDecorator,
): AnnotatableMatch[] {
  const found: AnnotatableMatch[] = [];
  const starts = new Set<number>();
  walkAnnotatable(root, (node) => {
    if (
      node.kind === MatchKind.Ok && hasEditorMetadata(node, decorator) &&
      !starts.has(node.originalSpan.start)
    ) {
      starts.add(node.originalSpan.start);
      found.push(node);
    }
  });
  return found;
}

Deno.test("cli.editor_metadata", async (t) => {
  const match = await uffdaGrammar(SOURCE);
  assertEquals(match.kind, MatchKind.Ok);

  await t.step("reads module path extensions and text", () => {
    const [path] = annotated(match, EditorDecorator.ModulePath);
    assert(path);
    assertEquals(modulePathExtensions(path), [".uff"]);
    assertEquals(nodeText(path, SOURCE), "./a.uff");
  });

  await t.step("finds imported names inside an import", () => {
    const [importNode] = annotated(match, EditorDecorator.Import);
    assert(importNode);
    const name = findAnnotated(importNode, EditorDecorator.ImportedName);
    assert(name);
    assertEquals(nodeText(name, SOURCE), "A");
  });

  await t.step("reads the declared name of a declaration", () => {
    const [declaration] = annotated(match, EditorDecorator.Declaration);
    assert(declaration);
    assertEquals(declaredName(declaration), "X");
  });

  await t.step("reads name reference kinds, absent meaning every kind", () => {
    const kinds = annotated(match, EditorDecorator.NameReference).map(
      (node) => [nodeText(node, SOURCE), nameReferenceKinds(node)],
    );
    assertEquals(kinds.find(([text]) => text === "A"), ["A", ["rule"]]);
    assertEquals(kinds.find(([text]) => text === "X"), ["X", undefined]);
    assert(kinds.some(([, k]) => JSON.stringify(k) === '["func"]'));
  });

  await t.step("passes ancestors outermost first", () => {
    walkAnnotatable(match, (node, ancestors) => {
      if (!hasEditorMetadata(node, EditorDecorator.ImportedName)) return;
      assert(
        ancestors.some((a) => hasEditorMetadata(a, EditorDecorator.Import)),
      );
      assert(ancestors[0] === match);
    });
  });

  await t.step("returns nothing for undecorated nodes", () => {
    assertEquals(editorMetadata(match, EditorDecorator.Import), undefined);
    assertEquals(nameReferenceKinds(match), undefined);
    assertEquals(modulePathExtensions(match), undefined);
    assertEquals(declaredName(match), undefined);
  });
});

Deno.test("cli.editor_metadata documentationOf", () => {
  assertEquals(
    documentationOf({
      Documentation: {
        description: "Pair of P.",
        parameters: { P: "the element", Q: 1 },
      },
    }),
    { description: "Pair of P.", parameters: { P: "the element" } },
  );
  assertEquals(
    documentationOf({ Documentation: { description: "Only text." } }),
    { description: "Only text.", parameters: {} },
  );
  assertEquals(documentationOf({ Documentation: "raw string" }), undefined);
  assertEquals(documentationOf({ Highlight: { role: "string" } }), undefined);
  assertEquals(documentationOf(undefined), undefined);
});
