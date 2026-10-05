import { Type, type } from "@justinmchase/type";
import { join, toFileUrl } from "@std/path";
import { resolveGrammarModule } from "../lang/grammar.ts";
import type { LanguageGrammar } from "../lang/language_rule.ts";
import {
  ModuleSpecifierKind,
  parseModuleSpecifier,
} from "../lang/uffda/specifier.ts";
import { UFFDA_GRAMMAR } from "../lang/uffda/uffda.lang.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import type { Rule } from "../runtime/modules/rule.ts";
import {
  loadCommandProject,
  PROJECT_FILE_NAME,
  ProjectLoadKind,
  type UffdaProject,
} from "../project/mod.ts";
import {
  LANGUAGE_DECORATOR_NAME,
  type LanguageMetadata,
  readLanguageMetadata,
} from "./language_metadata.ts";
import { compileModuleGraph } from "./module_graph.ts";
import { parseFailureMessage } from "./stream.ts";

/**
 * A language the project serves: its `[Language]` metadata and the grammar
 * its documents parse with (see
 * `.agents/specifications/languages/project-file.spec.md#languages`).
 */
export type ProjectLanguage = LanguageMetadata & {
  grammar: LanguageGrammar;
  /**
   * The project file's `languages` entry the language came from, or
   * `undefined` for the built-in `.uff` language.
   */
  specifier?: string;
};

export type ProjectLanguages = {
  /** The project, when one was found and is valid. */
  project?: UffdaProject;
  /** The languages served, each extension belonging to at most one. */
  languages: ProjectLanguage[];
  /** Why the project, or some of its languages, cannot be served. */
  problems: string[];
};

type LanguagesOfModule =
  | { ok: true; languages: ProjectLanguage[]; problems: string[] }
  | { ok: false; message: string };

function isRule(member: unknown): member is Rule {
  const [t, v] = type(member);
  return t === Type.Object && "pattern" in (v as object);
}

/**
 * The languages a grammar module declares: each exported rule carrying
 * `[Language]` metadata is one, with that rule as its entry rule.
 */
export async function languagesOfModule(
  moduleUrl: URL,
  declarations?: Record<string, ModuleDeclaration>,
  specifier?: string,
): Promise<LanguagesOfModule> {
  const resolved = await resolveGrammarModule({
    moduleUrl,
    grammarOptions: { declarations },
  });
  if (!resolved.ok) {
    return { ok: false, message: await parseFailureMessage(resolved.error) };
  }
  const languages: ProjectLanguage[] = [];
  const problems: string[] = [];
  for (const member of resolved.resolved.module.exports.values()) {
    if (!isRule(member)) continue;
    const raw = member.metadata?.[LANGUAGE_DECORATOR_NAME];
    if (raw === undefined) continue;
    const reading = readLanguageMetadata(raw);
    if (!reading.ok) {
      problems.push(`${reading.message}, on rule ${member.name}`);
      continue;
    }
    languages.push({
      ...reading.metadata,
      grammar: {
        moduleUrl: member.module.moduleUrl,
        entryRuleName: member.name,
        ...(declarations ? { declarations } : {}),
      },
      ...(specifier !== undefined ? { specifier } : {}),
    });
  }
  if (languages.length === 0 && problems.length === 0) {
    return {
      ok: false,
      message: "exports no rule with [Language] metadata",
    };
  }
  return { ok: true, languages, problems };
}

let builtinLoad: Promise<LanguagesOfModule> | undefined;

/** The built-in `.uff` language, from its own grammar's `[Language]`. */
export async function builtinLanguages(): Promise<ProjectLanguage[]> {
  builtinLoad ??= languagesOfModule(UFFDA_GRAMMAR.moduleUrl);
  const loaded = await builtinLoad;
  if (!loaded.ok) {
    throw new Error(`The built-in .uff language: ${loaded.message}`);
  }
  if (loaded.problems.length > 0) {
    throw new Error(
      `The built-in .uff language: ${loaded.problems.join("; ")}`,
    );
  }
  return loaded.languages;
}

/** Whether `language` is the built-in `.uff` language. */
export function isBuiltinLanguage(language: ProjectLanguage): boolean {
  return language.specifier === undefined;
}

async function languagesOfEntry(
  project: UffdaProject,
  specifier: string,
): Promise<LanguagesOfModule> {
  const parsed = await parseModuleSpecifier(specifier);
  if (parsed?.kind !== ModuleSpecifierKind.Relative) {
    return {
      ok: false,
      message: "loading languages from packages is not supported yet",
    };
  }
  const moduleUrl = new URL(specifier, toFileUrl(join(project.root, "/")));
  const graph = await compileModuleGraph(moduleUrl, project.imports);
  if (!graph.ok) {
    return {
      ok: false,
      message: graph.moduleUrl === moduleUrl.href
        ? graph.message
        : `${graph.moduleUrl}: ${graph.message}`,
    };
  }
  return await languagesOfModule(moduleUrl, graph.declarations, specifier);
}

/**
 * Keeps one language per id and per extension (see
 * `.agents/specifications/languages/project-file.spec.md#languages`). A
 * project language takes over an id or extension of the built-in language. An
 * id or extension two or more project languages claim is a problem: none of
 * them keeps it, and the rest of the project is still served.
 */
export function settleOwnership(
  builtin: readonly ProjectLanguage[],
  declared: readonly ProjectLanguage[],
): { languages: ProjectLanguage[]; problems: string[] } {
  const problems: string[] = [];
  const claimants = (key: (language: ProjectLanguage) => string[]) => {
    const claims = new Map<string, string[]>();
    for (const language of declared) {
      for (const value of new Set(key(language))) {
        claims.set(value, [...claims.get(value) ?? [], language.id]);
      }
    }
    return claims;
  };
  const describe = (ids: string[]) => ids.map((id) => `'${id}'`).join(", ");

  const ids = claimants(({ id }) => [id]);
  const sharedIds = new Set<string>();
  for (const [id, claiming] of ids) {
    if (claiming.length > 1) {
      sharedIds.add(id);
      problems.push(
        `The language id '${id}' is declared by more than one language in ${PROJECT_FILE_NAME}; none of them is served`,
      );
    }
  }
  const unique = declared.filter(({ id }) => !sharedIds.has(id));

  const extensions = claimants(({ extensions }) => extensions);
  const sharedExtensions = new Set<string>();
  for (const [extension, claiming] of extensions) {
    if (claiming.length > 1) {
      sharedExtensions.add(extension);
      problems.push(
        `The '${extension}' extension is claimed by more than one language (${
          describe(claiming)
        }) in ${PROJECT_FILE_NAME}; none of them serves it`,
      );
    }
  }

  const keep = (language: ProjectLanguage, owned: (ext: string) => boolean) => {
    const kept = language.extensions.filter(owned);
    return kept.length === language.extensions.length
      ? language
      : { ...language, extensions: kept };
  };
  const languages = [
    ...builtin
      .filter(({ id }) => !ids.has(id))
      .map((language) => keep(language, (ext) => !extensions.has(ext))),
    ...unique.map((language) =>
      keep(language, (ext) => !sharedExtensions.has(ext))
    ),
  ];
  return { languages, problems };
}

/**
 * The languages served for documents under `start`: the built-in `.uff`
 * language plus the languages of the project file's `languages` (the file
 * `configPath` names, else the nearest one). Problems never stop the rest
 * from being served.
 */
export async function loadProjectLanguages(
  start: string,
  configPath?: string,
): Promise<ProjectLanguages> {
  const builtin = await builtinLanguages();
  const loaded = await loadCommandProject(start, configPath);
  switch (loaded.kind) {
    case ProjectLoadKind.Missing:
      return { languages: [...builtin], problems: [] };
    case ProjectLoadKind.Invalid:
      return {
        languages: [...builtin],
        problems: loaded.problems.map(({ message }) =>
          `${loaded.path}: ${message}`
        ),
      };
    case ProjectLoadKind.Loaded:
      break;
    default:
      throw new Error(`Unknown project load result: ${JSON.stringify(loaded)}`);
  }
  const { project } = loaded;
  const declared: ProjectLanguage[] = [];
  const problems: string[] = [];
  for (const specifier of project.languages) {
    const entry = await languagesOfEntry(project, specifier);
    if (!entry.ok) {
      problems.push(
        `${PROJECT_FILE_NAME} language "${specifier}": ${entry.message}`,
      );
      continue;
    }
    declared.push(...entry.languages);
    problems.push(
      ...entry.problems.map((message) =>
        `${PROJECT_FILE_NAME} language "${specifier}": ${message}`
      ),
    );
  }
  const settled = settleOwnership(builtin, declared);
  return {
    project,
    languages: settled.languages,
    problems: [...problems, ...settled.problems],
  };
}

/** A document's file extension, lowercased, with its leading dot. */
export function extensionOf(uriOrPath: string): string {
  const withoutQuery = uriOrPath.split(/[?#]/, 1)[0];
  const lastDot = withoutQuery.lastIndexOf(".");
  const lastSlash = Math.max(
    withoutQuery.lastIndexOf("/"),
    withoutQuery.lastIndexOf("\\"),
  );
  if (lastDot === -1 || lastDot < lastSlash) return "";
  return withoutQuery.slice(lastDot).toLowerCase();
}

/** The language owning `uriOrPath`, by extension, if any. */
export function languageForDocument(
  languages: readonly ProjectLanguage[],
  uriOrPath: string,
): ProjectLanguage | undefined {
  const extension = extensionOf(uriOrPath);
  if (extension === "") return undefined;
  return languages.find(({ extensions }) => extensions.includes(extension));
}
