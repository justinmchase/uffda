import { isClean, MatchKind, valueOf } from "../match.ts";
import { compileUffdaSource } from "../lang/uffda/execute.ts";

/** The names a `.uff` source file exports, as its compiled module declares. */
export async function uffExportNames(path: string): Promise<string[]> {
  const compiled = await compileUffdaSource(await Deno.readTextFile(path));
  if (!isClean(compiled) || compiled.kind !== MatchKind.Ok) {
    throw new Error(`${path} does not compile: ${compiled.kind}`);
  }
  return valueOf(compiled).exports.map(({ name }) => name);
}
