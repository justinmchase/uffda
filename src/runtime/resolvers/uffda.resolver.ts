import { IModuleDeclaration } from "../declarations/module.ts";
import { IModuleResolver } from "./resolver.ts";
import { uffda } from "../../uffda.ts";

export class UffdaResolver implements IModuleResolver {
  public readonly extension = ".uff";
  async resolveModule(moduleUrl: string): Promise<IModuleDeclaration> {
    const uff = await this.fetchContent(moduleUrl);
    return await uffda()(uff);
  }

  async fetchContent(moduleUrl: string) {
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
