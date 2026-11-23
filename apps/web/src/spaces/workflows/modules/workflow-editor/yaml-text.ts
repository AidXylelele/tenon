import type { LSPClient } from "@codemirror/lsp-client";
import { isObject } from "@/libs/json/json";
import { textFromJson } from "@/operations/workflow-language";

export async function yamlOf(
  client: LSPClient,
  loaded: string,
): Promise<string> {
  try {
    const value: unknown = JSON.parse(loaded);

    if (!isObject(value)) return loaded;

    const converted = await textFromJson(client, value);
    return converted.text;
  } catch {
    return loaded;
  }
}
