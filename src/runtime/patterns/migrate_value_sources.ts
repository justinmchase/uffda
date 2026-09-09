import type { ModuleDeclaration } from "../declarations/module.ts";
import { ValueSourceKind } from "./value_source.ts";

function isWrappedValueSource(value: unknown): boolean {
  if (value == null || typeof value !== "object") return false;
  const record = value as { kind?: unknown };
  return record.kind === ValueSourceKind.Literal ||
    record.kind === ValueSourceKind.Variable;
}

function wrapLiteral(value: unknown): unknown {
  if (isWrappedValueSource(value)) return value;
  return { kind: ValueSourceKind.Literal, value };
}

function migratePattern(node: unknown): void {
  if (node == null || typeof node !== "object") return;
  const pattern = node as Record<string, unknown>;

  switch (pattern.kind) {
    case "equal":
      if ("value" in pattern && !isWrappedValueSource(pattern.value)) {
        pattern.value = wrapLiteral(pattern.value);
      }
      break;
    case "between":
      if ("left" in pattern && !isWrappedValueSource(pattern.left)) {
        pattern.left = wrapLiteral(pattern.left);
      }
      if ("right" in pattern && !isWrappedValueSource(pattern.right)) {
        pattern.right = wrapLiteral(pattern.right);
      }
      break;
    case "includes":
      if (Array.isArray(pattern.values)) {
        pattern.values = pattern.values.map((v) => wrapLiteral(v));
      }
      break;
    case "quantifier":
      if (
        "min" in pattern && pattern.min !== undefined &&
        !isWrappedValueSource(pattern.min)
      ) {
        pattern.min = wrapLiteral(pattern.min);
      }
      if (
        "max" in pattern && pattern.max !== undefined &&
        !isWrappedValueSource(pattern.max)
      ) {
        pattern.max = wrapLiteral(pattern.max);
      }
      if ("pattern" in pattern) migratePattern(pattern.pattern);
      return;
  }

  for (
    const key of [
      "pattern",
      "patterns",
      "steps",
      "keys",
    ] as const
  ) {
    const child = pattern[key];
    if (child == null) continue;
    if (Array.isArray(child)) {
      for (const item of child) migratePattern(item);
    } else if (typeof child === "object") {
      if (key === "keys") {
        for (const nested of Object.values(child as Record<string, unknown>)) {
          migratePattern(nested);
        }
      } else {
        migratePattern(child);
      }
    }
  }
}

/** Upgrade legacy bare operands in a module declaration to explicit ValueSource nodes. */
export function migrateModuleValueSources(
  module: ModuleDeclaration,
): ModuleDeclaration {
  for (const rule of module.rules) {
    migratePattern(rule.pattern);
  }
  return module;
}
