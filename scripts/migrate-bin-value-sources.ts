/**
 * Wrap bare serializable operands in compiled ./bin AST JSON with value.literal.
 * Run after compile:lang until the published compiler emits ValueSource directly.
 */
import { walk } from "@std/fs/walk";
import type { ModuleDeclaration } from "../src/runtime/declarations/module.ts";
import { migrateModuleValueSources } from "../src/runtime/patterns/migrate_value_sources.ts";

const ROOT = new URL("../bin/ast/", import.meta.url).pathname;
let changed = 0;

for await (const entry of walk(ROOT, { exts: [".json"] })) {
  if (!entry.isFile) continue;
  const raw = await Deno.readTextFile(entry.path);
  const parsed = JSON.parse(raw) as ModuleDeclaration;
  const before = JSON.stringify(parsed);
  migrateModuleValueSources(parsed);
  const after = JSON.stringify(parsed);
  if (before !== after) {
    await Deno.writeTextFile(
      entry.path,
      JSON.stringify(parsed, null, 2) + "\n",
    );
    changed++;
  }
}

console.log(`Migrated ${changed} bin AST files.`);
