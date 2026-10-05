import { assert, assertEquals } from "@std/assert";
import {
  languageMetadataFor,
  readLanguageMetadata,
} from "./language_metadata.ts";

Deno.test("cli.language_metadata readLanguageMetadata", async (t) => {
  await t.step("reads id, name, description and extensions", () => {
    assertEquals(
      readLanguageMetadata({
        id: "foo",
        name: "Foo",
        description: "A foo.",
        extensions: [".foo", ".FOOX"],
        extraneous: "ignored",
      }),
      {
        ok: true,
        metadata: {
          id: "foo",
          name: "Foo",
          description: "A foo.",
          extensions: [".foo", ".foox"],
        },
      },
    );
  });

  await t.step("drops optional fields of the wrong type", () => {
    assertEquals(
      readLanguageMetadata({ id: "foo", name: 1, extensions: [".foo"] }),
      { ok: true, metadata: { id: "foo", extensions: [".foo"] } },
    );
  });

  await t.step("requires an object", () => {
    for (const value of [undefined, "nope", 42, [".foo"]]) {
      assert(!readLanguageMetadata(value).ok);
    }
  });

  await t.step("requires an id", () => {
    const reading = readLanguageMetadata({ extensions: [".foo"] });
    assert(!reading.ok);
    assert(reading.message.includes("`id`"));
  });

  await t.step("requires extensions with their leading dot", () => {
    for (
      const extensions of [undefined, [], ["foo"], [".a.b"], [".a b"], [1]]
    ) {
      const reading = readLanguageMetadata({ id: "foo", extensions });
      assert(!reading.ok, JSON.stringify(extensions));
      assert(reading.message.includes("`extensions`"));
    }
  });

  await t.step(
    "comment syntax and bracket pairs are not language metadata",
    () => {
      assertEquals(
        readLanguageMetadata({
          id: "foo",
          extensions: [".foo"],
          comment: "#",
          brackets: [["{", "}"]],
        }),
        { ok: true, metadata: { id: "foo", extensions: [".foo"] } },
      );
    },
  );
});

Deno.test("cli.language_metadata languageMetadataFor", async (t) => {
  const languages = [
    { id: "uffda", name: "Uffda", extensions: [".uff"] },
    { id: "foo", extensions: [".foo"] },
  ];

  await t.step("lists every language", () => {
    assertEquals(languageMetadataFor(languages), { languages });
  });

  await t.step("or one language by id", () => {
    assertEquals(languageMetadataFor(languages, { languageId: "foo" }), {
      languages: [{ id: "foo", extensions: [".foo"] }],
    });
    assertEquals(
      languageMetadataFor(languages, { languageId: "missing" }),
      { languages: [] },
    );
  });
});
