import { Type, type } from "@justinmchase/type";

/** The lockfile beside a project file (see `project-file.spec.md#lockfile`). */
export const LOCKFILE_NAME = "uffda.lock";

export type LockfileData = {
  /** `jsr:@scope/name@range` to the version chosen for it. */
  specifiers: Record<string, string>;
  /** `@scope/name@version` to the sha256 hex of its `<version>_meta.json`. */
  jsr: Record<string, { integrity: string }>;
};

export type LockfileLoadResult =
  | { ok: true; lockfile: Lockfile }
  | { ok: false; message: string };

function sorted<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0),
  );
}

function readData(value: unknown): LockfileData | undefined {
  const [t, v] = type(value);
  if (t !== Type.Object) return undefined;
  const { specifiers = {}, jsr = {}, ...rest } = v as Record<string, unknown>;
  if (Object.keys(rest).length > 0) return undefined;
  const [st, sv] = type(specifiers);
  const [jt, jv] = type(jsr);
  if (st !== Type.Object || jt !== Type.Object) return undefined;
  const data: LockfileData = { specifiers: {}, jsr: {} };
  for (const [key, version] of Object.entries(sv as Record<string, unknown>)) {
    if (type(version)[0] !== Type.String) return undefined;
    data.specifiers[key] = version as string;
  }
  for (const [key, entry] of Object.entries(jv as Record<string, unknown>)) {
    const [et, ev] = type(entry);
    if (et !== Type.Object) return undefined;
    const { integrity, ...extra } = ev as Record<string, unknown>;
    if (type(integrity)[0] !== Type.String || Object.keys(extra).length > 0) {
      return undefined;
    }
    data.jsr[key] = { integrity: integrity as string };
  }
  return data;
}

/**
 * The versions and integrities a project's packages resolved to. A lockfile
 * with a `path` writes itself there whenever resolution adds to it; one
 * without (no project) lives only in memory.
 */
export class Lockfile {
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private readonly data: LockfileData = { specifiers: {}, jsr: {} },
    public readonly path?: string,
  ) {}

  /** Reads the lockfile at `path`; a missing one is empty. */
  static async load(path: string): Promise<LockfileLoadResult> {
    let text: string;
    try {
      text = await Deno.readTextFile(path);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return { ok: true, lockfile: new Lockfile(undefined, path) };
      }
      return {
        ok: false,
        message: `${path}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return {
        ok: false,
        message: `${path}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
    const data = readData(parsed);
    return data ? { ok: true, lockfile: new Lockfile(data, path) } : {
      ok: false,
      message:
        `${path}: must hold an object of \`specifiers\` (to versions) and \`jsr\` (to { integrity })`,
    };
  }

  version(specifierKey: string): string | undefined {
    return this.data.specifiers[specifierKey];
  }

  integrity(packageVersion: string): string | undefined {
    return this.data.jsr[packageVersion]?.integrity;
  }

  async setVersion(specifierKey: string, version: string): Promise<void> {
    if (this.data.specifiers[specifierKey] === version) return;
    this.data.specifiers[specifierKey] = version;
    await this.save();
  }

  async setIntegrity(packageVersion: string, integrity: string): Promise<void> {
    if (this.data.jsr[packageVersion]?.integrity === integrity) return;
    this.data.jsr[packageVersion] = { integrity };
    await this.save();
  }

  /** The lockfile's JSON text, keys sorted. */
  toText(): string {
    return `${
      JSON.stringify(
        {
          specifiers: sorted(this.data.specifiers),
          jsr: sorted(this.data.jsr),
        },
        null,
        2,
      )
    }\n`;
  }

  private save(): Promise<void> {
    const path = this.path;
    if (path === undefined) return Promise.resolve();
    this.writing = this.writing.then(() =>
      Deno.writeTextFile(path, this.toText())
    );
    return this.writing;
  }
}
