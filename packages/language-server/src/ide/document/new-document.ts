import { type Analysis, standardVersion } from "interpreter/front-end";
import { childPointerOf } from "../pointers/index.js";
import { yamlOf } from "../yaml-text/index.js";
import type {
  NewDocumentParam,
  NewDocumentParams,
  NewDocumentResult,
} from "./interfaces.js";

const headerParams: readonly NewDocumentParam[] = [
  "namespace",
  "name",
  "version",
];

export function newDocumentOf(
  header: NewDocumentParams,
  analyze: (text: string) => Analysis,
): NewDocumentResult {
  const { namespace, name, version } = header;
  const smallest = {
    document: { dsl: standardVersion, namespace, name, version },
    do: [],
  };
  const text = yamlOf(smallest);
  const analysis = analyze(text);
  const found = analysis.diagnostics.map((diagnostic) => diagnostic.pointer);
  const pointers = new Set(found);
  const refused = headerParams.filter((param) => {
    const pointer = childPointerOf("/document", param);
    return pointers.has(pointer);
  });

  if (refused.length > 0) {
    return { kind: "refused", params: refused };
  }

  return { kind: "text", text };
}
