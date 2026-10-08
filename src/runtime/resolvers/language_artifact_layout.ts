import { PackageUffArtifactResolver } from "./uff.artifact.resolver.ts";

/**
 * Root URL of the uffda package holding this module, whatever the working
 * directory: the checkout root in a `file:` checkout, the extract root in a
 * `deno compile --include ./bin` binary, or the published package root (for
 * example `https://jsr.io/@justinmchase/uffda/<version>/`) when a consumer
 * imports `jsr:@justinmchase/uffda`. The built-in `.uff` languages' compiled
 * artifacts live under this root's `./bin`.
 */
export function languageArtifactPackageRoot(): URL {
  return new URL("../../../", import.meta.url);
}

/**
 * The `.uff` resolver for the built-in languages: it reads their compiled
 * `./bin` ModuleDeclaration JSON from the package this module ships in,
 * addressed relative to {@link languageArtifactPackageRoot}. This loads the
 * artifacts from the package wherever it lives — a local checkout or compiled
 * binary (read directly) or a published JSR package (fetched over the network),
 * so the built-in grammars work without a repository checkout (see
 * https://github.com/justinmchase/uffda/issues/271).
 */
export function builtInUffResolver(): PackageUffArtifactResolver {
  return new PackageUffArtifactResolver(languageArtifactPackageRoot());
}
