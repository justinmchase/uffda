import { IModuleDeclaration } from "../declarations/module.ts";
import { IModuleResolver } from "./resolver.ts";

export class JsonResolver implements IModuleResolver {
  public readonly extension = ".json"
  async resolveModule(modulePath: string): Promise<IModuleDeclaration> {
    const json = await this.fetchContent(modulePath)
    return await JSON.parse(json)
  }
  
  async fetchContent(modulePath: string) {
    const url = new URL(modulePath)
    if (url.protocol === "file:") {
      return await Deno.readTextFile(url.pathname)
    } else if (url.protocol === "http:" || url.protocol === "https:") {
      const result = await fetch(modulePath);
      return await result.text()
    } else {
      throw new Error(`Uknonwn protocol ${url.protocol}`);
    }
  }
}