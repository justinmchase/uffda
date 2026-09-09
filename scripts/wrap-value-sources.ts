/**
 * One-off codemod: wrap bare serializable operands in hand-built Pattern ASTs
 * with lit(...). Run from repo root: deno run --allow-read --allow-write scripts/wrap-value-sources.ts
 */
import { walk } from "@std/fs/walk";
import { relative } from "@std/path";

const ROOT = new URL("../src/", import.meta.url).pathname;

const SKIP_FILES = new Set([
  "value_source.ts",
  "equal.ts",
  "between.ts",
  "includes.ts",
  "quantifier.ts",
]);

type PatternCtx =
  | "none"
  | "equal"
  | "between"
  | "includes"
  | "quantifier";

function isWrapped(expr: string): boolean {
  const t = expr.trim();
  return t.startsWith("lit(") ||
    t.startsWith("varRef(") ||
    t.startsWith("{ kind:") ||
    t.startsWith("{ kind :") ||
    t.startsWith("{kind:") ||
    t.includes("ValueSourceKind.");
}

function wrapExpr(expr: string): string {
  const trimmed = expr.trim().replace(/,\s*$/, "");
  if (isWrapped(trimmed)) return expr;
  const leading = expr.match(/^\s*/)?.[0] ?? "";
  const trailing = expr.match(/\s*$/)?.[0] ?? "";
  const comma = trimmed.endsWith(",") ? "," : "";
  const core = trimmed.replace(/,\s*$/, "");
  return `${leading}lit(${core})${comma}${trailing}`;
}

function wrapArrayElements(inner: string): string {
  if (!inner.trim()) return inner;
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts.map((p) => wrapExpr(p)).join(",");
}

function transformLine(
  line: string,
  ctx: PatternCtx,
): { line: string; ctx: PatternCtx } {
  const kindMatch = line.match(/kind:\s*PatternKind\.(\w+)/);
  if (kindMatch) {
    const k = kindMatch[1];
    if (k === "Equal") return { line, ctx: "equal" };
    if (k === "Between") return { line, ctx: "between" };
    if (k === "Includes") return { line, ctx: "includes" };
    if (k === "Quantifier") return { line, ctx: "quantifier" };
    return { line, ctx: "none" };
  }

  if (ctx === "equal") {
    const m = line.match(/^(\s*value:\s*)(.+)$/);
    if (m && !isWrapped(m[2])) {
      return { line: m[1] + wrapExpr(m[2]), ctx: "none" };
    }
    if (/^\s*\},/.test(line) || /^\s*\}/.test(line)) {
      return { line, ctx: "none" };
    }
  }

  if (ctx === "between") {
    const left = line.match(/^(\s*left:\s*)(.+)$/);
    if (left && !isWrapped(left[2])) {
      return { line: left[1] + wrapExpr(left[2]), ctx: "between" };
    }
    const right = line.match(/^(\s*right:\s*)(.+)$/);
    if (right && !isWrapped(right[2])) {
      return { line: right[1] + wrapExpr(right[2]), ctx: "none" };
    }
    if (/^\s*\},/.test(line) || /^\s*\}/.test(line)) {
      return { line, ctx: "none" };
    }
  }

  if (ctx === "includes") {
    const arr = line.match(/^(\s*values:\s*\[)([^\]]*)(\],?\s*)$/);
    if (arr) {
      const wrapped = wrapArrayElements(arr[2]);
      return { line: arr[1] + wrapped + arr[3], ctx: "none" };
    }
    if (/^\s*\},/.test(line) || /^\s*\}/.test(line)) {
      return { line, ctx: "none" };
    }
  }

  if (ctx === "quantifier") {
    const min = line.match(/^(\s*min:\s*)(.+)$/);
    if (min) {
      const val = min[2].trim();
      if (val === "undefined," || val === "undefined") {
        return { line, ctx: "quantifier" };
      }
      if (!isWrapped(min[2])) {
        return { line: min[1] + wrapExpr(min[2]), ctx: "quantifier" };
      }
    }
    const max = line.match(/^(\s*max:\s*)(.+)$/);
    if (max) {
      const val = max[2].trim();
      if (val === "undefined," || val === "undefined") {
        return { line, ctx: "none" };
      }
      if (!isWrapped(max[2])) {
        return { line: max[1] + wrapExpr(max[2]), ctx: "none" };
      }
    }
    if (/^\s*\},/.test(line) || /^\s*\}/.test(line)) {
      return { line, ctx: "none" };
    }
  }

  return { line, ctx };
}

function transformInline(content: string): string {
  let result = content;
  result = result.replace(
    /\{\s*kind:\s*PatternKind\.Equal,\s*value:\s*(?!lit\(|varRef\(|\{)([^,}\]]+)\}/g,
    (_, val) => `{ kind: PatternKind.Equal, value: lit(${val.trim()}) }`,
  );
  result = result.replace(
    /\{\s*kind:\s*PatternKind\.Between,\s*left:\s*(?!lit\(|varRef\(|\{)([^,]+),\s*right:\s*(?!lit\(|varRef\(|\{)([^,}\]]+)\}/g,
    (_, left, right) =>
      `{ kind: PatternKind.Between, left: lit(${left.trim()}), right: lit(${right.trim()}) }`,
  );
  return result;
}

function transformContent(
  content: string,
): { content: string; needsLit: boolean } {
  let needsLit = false;
  const lines = content.split("\n");
  let ctx: PatternCtx = "none";
  const out: string[] = [];

  for (const line of lines) {
    const before = line;
    const next = transformLine(line, ctx);
    ctx = next.ctx;
    if (
      next.line !== before && !next.line.includes("lit(") &&
      before.includes("value:")
    ) {
      // might still need lit if wrap failed
    }
    if (next.line.includes("lit(") && !before.includes("lit(")) needsLit = true;
    if (
      /\bleft:\s*lit\(/.test(next.line) || /\bright:\s*lit\(/.test(next.line) ||
      /\bmin:\s*lit\(/.test(next.line) || /\bmax:\s*lit\(/.test(next.line)
    ) {
      if (!before.includes("lit(")) needsLit = true;
    }
    out.push(next.line);
  }

  let result = out.join("\n");
  const inlineBefore = result;
  result = transformInline(result);
  if (result !== inlineBefore) needsLit = true;

  return { content: result, needsLit };
}

function litImportPath(filePath: string): string {
  const rel = relative(ROOT, filePath).replace(/\\/g, "/");
  const depth = rel.split("/").length - 1;
  const prefix = "../".repeat(depth);
  if (rel.startsWith("runtime/patterns/")) {
    return "./value_source.ts";
  }
  return `${prefix}runtime/patterns/value_source.ts`;
}

function addLitImport(content: string, importPath: string): string {
  if (content.includes(`from "${importPath}"`) && content.includes("lit")) {
    const importRe = new RegExp(
      `import\\s*\\{([^}]*\\blit\\b[^}]*)\\}\\s*from\\s*"${
        importPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      }"`,
    );
    if (importRe.test(content)) return content;
  }

  const existingValueSource = content.match(
    /^import\s*\{([^}]+)\}\s*from\s*"([^"]*value_source\.ts)";/m,
  );
  if (existingValueSource) {
    const names = existingValueSource[1];
    if (!/\blit\b/.test(names)) {
      const newImport = `import { ${names.trim()}, lit } from "${
        existingValueSource[2]
      }";`;
      return content.replace(existingValueSource[0], newImport);
    }
    return content;
  }

  const patternImport = content.match(
    /^import\s*\{([^}]+)\}\s*from\s*"([^"]*pattern\.ts)";/m,
  );
  if (patternImport && !/\blit\b/.test(patternImport[1])) {
    const newImport = `import { ${patternImport[1].trim()}, lit } from "${
      patternImport[2]
    }";`;
    return content.replace(patternImport[0], newImport);
  }

  const patternKindImport = content.match(
    /^import\s*\{([^}]+)\}\s*from\s*"([^"]*pattern\.kind\.ts)";/m,
  );
  const insertAfter = patternKindImport?.[0] ??
    content.match(/^import .+$/m)?.[0];
  const litLine = `import { lit } from "${importPath}";`;
  if (insertAfter) {
    return content.replace(insertAfter, `${insertAfter}\n${litLine}`);
  }
  return `${litLine}\n${content}`;
}

let changed = 0;
for await (
  const entry of walk(ROOT, { exts: [".ts"], skip: [/node_modules/] })
) {
  if (!entry.isFile) continue;
  const base = entry.name;
  if (SKIP_FILES.has(base)) continue;

  const raw = await Deno.readTextFile(entry.path);
  if (!raw.includes("PatternKind.")) continue;

  const { content, needsLit } = transformContent(raw);
  if (content === raw) continue;

  const final = needsLit
    ? addLitImport(content, litImportPath(entry.path))
    : content;
  if (final !== raw) {
    await Deno.writeTextFile(entry.path, final);
    changed++;
    console.log(relative(ROOT, entry.path));
  }
}

console.log(`Updated ${changed} files.`);
