import { assertEquals } from "@std/assert";
import { compileStdinToArtifact } from "../../cli/stream.ts";
import { CliLanguage } from "../../cli/contract.ts";

Deno.test(
  "req:tokenizer-runtime-007 - pipeline and into preserve original source spans",
  async (t) => {
    await t.step(
      "mid-source pattern failures map through token layers to original offsets",
      async () => {
        const source = "export Main; rule Main = !!!;";
        const result = await compileStdinToArtifact(source);

        assertEquals(result.ok, false);
        if (result.ok) return;
        assertEquals(result.error.location?.offset, source.indexOf("!"));
      },
    );

    await t.step(
      "incomplete expression failures keep original offsets across tokenizer pipeline",
      async () => {
        const source = "[1 ";
        const result = await compileStdinToArtifact(
          source,
          CliLanguage.Expression,
        );

        assertEquals(result.ok, false);
        if (result.ok) return;
        assertEquals(result.error.location?.offset, 2);
      },
    );

    await t.step(
      "CRLF-normalized incomplete input reports the original end offset",
      async () => {
        const source = "export Main;\r\nrule Main =";
        const result = await compileStdinToArtifact(source);

        assertEquals(result.ok, false);
        if (result.ok) return;
        assertEquals(result.error.location?.offset, source.length);
      },
    );
  },
);
