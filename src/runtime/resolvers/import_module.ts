import { extname, fromFileUrl } from "@std/path";

/** Reads a JSON declaration as data, never as executable host code. */
export async function importModule(
  specifier: string,
  options?: ImportCallOptions,
): Promise<{ default?: unknown }> {
  const url = new URL(specifier);
  if (extname(url.pathname) !== ".json") {
    throw new Error(
      `Unable to resolve file of unknown extension ${extname(url.pathname)}`,
    );
  }
  if (options?.with?.type !== "json") {
    throw new Error("JSON module loading requires type json");
  }
  let text: string;
  if (url.protocol === "file:") {
    text = await Deno.readTextFile(fromFileUrl(url));
  } else if (url.protocol === "https:" || url.protocol === "http:") {
    const response = await fetch(url);
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`fetching ${url.href} failed with ${response.status}`);
    }
    text = await response.text();
  } else {
    throw new Error(`Unsupported JSON module protocol ${url.protocol}`);
  }
  return { default: JSON.parse(text) };
}
