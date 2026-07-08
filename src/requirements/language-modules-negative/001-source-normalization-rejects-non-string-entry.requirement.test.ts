import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl =
  new URL("../../lang/source-normalization/mod.ts", import.meta.url)
    .href;

Deno.test("req:language-modules-negative-001 - Source-normalization module rejects non-string source entry values", async () => {
  await moduleDeclarationTest({
    moduleUrl,
    input: Input.Scalar(123),
    kind: MatchKind.Fail,
  })();
});
