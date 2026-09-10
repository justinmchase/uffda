import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const langUff = join(
  repoRoot,
  "src",
  "lang",
  "tokenizer",
  "tokenizer.lang.uff",
);

Deno.test(
  "req:cli-bootstrap-041 - tokenizer.lang.uff pipelines Source and semantic_texts",
  async () => {
    const source = await Deno.readTextFile(langUff);
    assertEquals(source.includes("export rule TokenizerLang"), true);
    assertEquals(source.includes('import "../source/mod.uff" Source'), true);
    assertEquals(source.includes('import "./mod.uff" Tokenizer'), true);
    assertEquals(source.includes("(semantic_texts _)"), true);
    assertEquals(source.includes("s:Source"), true);
  },
);
