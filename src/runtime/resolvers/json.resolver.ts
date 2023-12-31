import { IModuleDeclaration } from "../declarations/module.ts";
import { IModuleResolver } from "./resolver.ts";

export class JsonResolver implements IModuleResolver {
  public readonly extension = ".json";
  async resolveModule(moduleUrl: URL): Promise<IModuleDeclaration> {
    const json = await this.fetchContent(moduleUrl);
    return await JSON.parse(json);
  }

  async fetchContent(moduleUrl: URL) {
    const url = new URL(moduleUrl);
    if (url.protocol === "file:") {
      return await Deno.readTextFile(url.pathname);
    } else if (url.protocol === "http:" || url.protocol === "https:") {
      const result = await fetch(moduleUrl);
      return await result.text();
    } else {
      throw new Error(`Uknonwn protocol ${url.protocol}`);
    }
  }
}
