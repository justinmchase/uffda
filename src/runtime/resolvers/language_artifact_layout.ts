import { fromFileUrl } from "@std/path";
import { type ArtifactLayout, defaultArtifactLayout } from "./artifact_path.ts";

/**
 * Artifact layout the built-in `.uff` languages are read from: the `./bin` of
 * the uffda package holding this module, whatever the working directory. In a
 * checkout that is the workspace `./bin` (`compile:lang`); in a published
 * binary it is the `./bin` embedded with `deno compile --include`, under the
 * binary's extract root.
 */
export function languageArtifactLayout(): ArtifactLayout {
  const packageRoot = new URL("../../../", import.meta.url);
  if (packageRoot.protocol !== "file:") {
    throw new Error(
      `The built-in languages are read from a local copy of uffda, and ${packageRoot.href} is not one`,
    );
  }
  return defaultArtifactLayout(fromFileUrl(packageRoot));
}
