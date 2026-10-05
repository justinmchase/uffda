import { Type, type } from "@justinmchase/type";
import { parse as parseJsonc } from "@std/jsonc";
import { dirname } from "@std/path";
import {
  ModuleSpecifierKind,
  parseModuleSpecifier,
} from "../lang/uffda/specifier.ts";
import { aliasOf, isUnderAlias } from "../runtime/resolvers/import_map.ts";

/**
 * The project file (see
 * `.agents/specifications/languages/project-file.spec.md`).
 */
export const PROJECT_FILE_NAME = "uffda.jsonc";

export type UffdaProject = {
  /** Absolute path of the directory holding the project file. */
  root: string;
  /** Absolute path of the project file. */
  path: string;
  /** Module names, each mapped to the `jsr:` specifier it stands for. */
  imports: Map<string, string>;
  /** Export names (`.` or `./name`), each mapped to a project-relative path. */
  exports: Map<string, string>;
  /** The module specifiers of the grammars the project uses, as written. */
  languages: string[];
};

export enum ProjectProblemCode {
  ReadFailure = "PROJECT_READ_FAILURE",
  ParseFailure = "PROJECT_PARSE_FAILURE",
  InvalidField = "PROJECT_INVALID_FIELD",
}

export type ProjectProblem = {
  code: ProjectProblemCode;
  message: string;
};

export type ProjectParseResult =
  | { ok: true; project: UffdaProject }
  | { ok: false; problems: ProjectProblem[] };

const FIELDS = ["imports", "exports", "languages"];

const SPECIFIER_FORMS =
  "a relative path starting with `./` or `../`, a module name starting with " +
  "`@`, or a `jsr:` specifier";

function invalid(message: string): ProjectProblem {
  return { code: ProjectProblemCode.InvalidField, message };
}

async function readImports(
  value: unknown,
  problems: ProjectProblem[],
): Promise<Map<string, string>> {
  const imports = new Map<string, string>();
  if (value === undefined) return imports;
  const [t, v] = type(value);
  if (t !== Type.Object) {
    problems.push(invalid("`imports` must be an object of module names."));
    return imports;
  }
  for (const [name, target] of Object.entries(v as Record<string, unknown>)) {
    const key = await parseModuleSpecifier(name);
    if (key?.kind !== ModuleSpecifierKind.Name) {
      problems.push(
        invalid(
          `\`imports\` key ${
            JSON.stringify(name)
          } must be a module name starting with \`@\`, as in "@acme/kv".`,
        ),
      );
      continue;
    }
    const [tt, tv] = type(target);
    const specifier = tt === Type.String
      ? await parseModuleSpecifier(tv as string)
      : undefined;
    if (specifier?.kind !== ModuleSpecifierKind.Jsr) {
      problems.push(
        invalid(
          `\`imports[${
            JSON.stringify(name)
          }]\` must be a \`jsr:\` specifier, as in "jsr:@acme/kv@^1.2.0".`,
        ),
      );
      continue;
    }
    imports.set(name, specifier.text);
  }
  const names = [...imports.keys()];
  for (const alias of names) {
    for (const other of names) {
      if (other !== alias && isUnderAlias(other, alias)) {
        problems.push(
          invalid(
            `\`imports\` ${JSON.stringify(alias)} overlaps ${
              JSON.stringify(other)
            }: a module name may not be the start of another.`,
          ),
        );
      }
    }
  }
  return imports;
}

async function isProjectPath(text: string): Promise<boolean> {
  const specifier = await parseModuleSpecifier(text);
  return specifier?.kind === ModuleSpecifierKind.Relative &&
    text.startsWith("./");
}

async function readExports(
  value: unknown,
  problems: ProjectProblem[],
): Promise<Map<string, string>> {
  const exports = new Map<string, string>();
  if (value === undefined) return exports;
  const [t, v] = type(value);
  if (t !== Type.Object) {
    problems.push(invalid("`exports` must be an object of export names."));
    return exports;
  }
  for (const [name, target] of Object.entries(v as Record<string, unknown>)) {
    if (name !== "." && !await isProjectPath(name)) {
      problems.push(
        invalid(
          `\`exports\` key ${
            JSON.stringify(name)
          } must be "." or an export name starting with "./", as in "./tokens".`,
        ),
      );
      continue;
    }
    const [tt, tv] = type(target);
    if (tt !== Type.String || !await isProjectPath(tv as string)) {
      problems.push(
        invalid(
          `\`exports[${
            JSON.stringify(name)
          }]\` must be a path inside the project starting with "./", as in "./src/kv.uff".`,
        ),
      );
      continue;
    }
    exports.set(name, tv as string);
  }
  return exports;
}

async function readLanguages(
  value: unknown,
  imports: ReadonlyMap<string, string>,
  problems: ProjectProblem[],
): Promise<string[]> {
  const languages: string[] = [];
  if (value === undefined) return languages;
  const [t, v] = type(value);
  if (t !== Type.Array) {
    problems.push(
      invalid("`languages` must be an array of module specifiers."),
    );
    return languages;
  }
  for (const [index, entry] of (v as unknown[]).entries()) {
    const [et, ev] = type(entry);
    const specifier = et === Type.String
      ? await parseModuleSpecifier(ev as string)
      : undefined;
    if (!specifier) {
      problems.push(
        invalid(`\`languages[${index}]\` must be ${SPECIFIER_FORMS}.`),
      );
      continue;
    }
    if (
      specifier.kind === ModuleSpecifierKind.Name &&
      !aliasOf(imports, specifier.text)
    ) {
      problems.push(
        invalid(
          `\`languages[${index}]\` names ${
            JSON.stringify(specifier.text)
          }, which \`imports\` does not declare.`,
        ),
      );
      continue;
    }
    if (languages.includes(specifier.text)) {
      problems.push(
        invalid(
          `\`languages[${index}]\` repeats ${JSON.stringify(specifier.text)}.`,
        ),
      );
      continue;
    }
    languages.push(specifier.text);
  }
  return languages;
}

/**
 * Reads the text of the project file at `path`, reporting every problem in it
 * rather than the first.
 */
export async function parseProject(
  text: string,
  path: string,
): Promise<ProjectParseResult> {
  let parsed: unknown;
  try {
    parsed = parseJsonc(text);
  } catch (error) {
    return {
      ok: false,
      problems: [{
        code: ProjectProblemCode.ParseFailure,
        message: error instanceof Error ? error.message : String(error),
      }],
    };
  }
  const [t, v] = type(parsed);
  if (t !== Type.Object) {
    return {
      ok: false,
      problems: [invalid(`${PROJECT_FILE_NAME} must hold an object.`)],
    };
  }
  const fields = v as Record<string, unknown>;
  const problems: ProjectProblem[] = [];
  for (const field of Object.keys(fields)) {
    if (!FIELDS.includes(field)) {
      problems.push(
        invalid(
          `Unknown field \`${field}\`: ${PROJECT_FILE_NAME} has \`imports\`, \`exports\` and \`languages\`.`,
        ),
      );
    }
  }
  const imports = await readImports(fields.imports, problems);
  const exports = await readExports(fields.exports, problems);
  const languages = await readLanguages(fields.languages, imports, problems);
  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    project: { root: dirname(path), path, imports, exports, languages },
  };
}
