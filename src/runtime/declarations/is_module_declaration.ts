import type { ModuleDeclaration } from "../declarations/module.ts";

/** Runtime ModuleDeclaration shape written to `./bin` by compile. */
export function isModuleDeclaration(
  value: unknown,
): value is ModuleDeclaration {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.imports) &&
    Array.isArray(record.exports) &&
    Array.isArray(record.rules);
}
