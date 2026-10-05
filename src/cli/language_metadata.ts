import { Type, type } from "@justinmchase/type";

/**
 * A language's description of itself: the `[Language]` metadata on the rule
 * of its grammar that documents of the language parse with (see
 * `.agents/specifications/languages/cli/editor-metadata.spec.md#language-metadata`).
 * `[Language]` may carry further properties this module ignores. Comment
 * syntax and bracket pairs are not language metadata: comment toggling comes
 * from `[ToggleComment]`, and the editor declares no brackets.
 */
export type LanguageMetadata = {
  /** Stable short identifier, such as `uffda`. */
  id: string;
  /** Editor-facing display name. */
  name?: string;
  /** Editor-facing description. */
  description?: string;
  /** File extensions the language owns, each with its leading dot. */
  extensions: string[];
};

export const LANGUAGE_DECORATOR_NAME = "Language";

/** Custom LSP request: the project's languages, as their metadata. */
export const LANGUAGE_METADATA_METHOD = "uffda/languageMetadata";

export type LanguageMetadataParams = {
  /** When set, only this language id is queried; otherwise every language. */
  languageId?: string;
};

export type LanguageMetadataResult = {
  languages: LanguageMetadata[];
};

export type LanguageMetadataReading =
  | { ok: true; metadata: LanguageMetadata }
  | { ok: false; message: string };

function optionalString(value: unknown): string | undefined {
  const [t, v] = type(value);
  return t === Type.String ? v as string : undefined;
}

function isExtension(value: unknown): boolean {
  const [t, v] = type(value);
  return t === Type.String && /^\.[^./\\\s]+$/.test(v as string);
}

/**
 * Reads a rule's raw `[Language]` metadata value. A grammar author controls
 * the attribute's values, so a missing or malformed `id` or `extensions` is
 * reported rather than trusted.
 */
export function readLanguageMetadata(value: unknown): LanguageMetadataReading {
  const [t, v] = type(value);
  if (t !== Type.Object) {
    return { ok: false, message: "[Language] must be an object" };
  }
  const fields = v as Record<string, unknown>;
  const id = optionalString(fields.id);
  if (!id) {
    return { ok: false, message: "[Language] needs a non-empty string `id`" };
  }
  const [et, ev] = type(fields.extensions);
  if (
    et !== Type.Array || (ev as unknown[]).length === 0 ||
    !(ev as unknown[]).every(isExtension)
  ) {
    return {
      ok: false,
      message:
        `[Language] '${id}' needs \`extensions\`, a non-empty array of extensions such as ".foo"`,
    };
  }
  const name = optionalString(fields.name);
  const description = optionalString(fields.description);
  return {
    ok: true,
    metadata: {
      id,
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      extensions: (ev as string[]).map((ext) => ext.toLowerCase()),
    },
  };
}

/**
 * Answers the `uffda/languageMetadata` request from the project's languages,
 * so a client can map file extensions to languages.
 */
export function languageMetadataFor(
  languages: readonly LanguageMetadata[],
  params?: LanguageMetadataParams,
): LanguageMetadataResult {
  const selected = params?.languageId
    ? languages.filter(({ id }) => id === params.languageId)
    : languages;
  return {
    languages: selected.map(({ id, name, description, extensions }) => ({
      id,
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      extensions,
    })),
  };
}
