import type { JsonValue } from "../../api/index.js";
import { isJsonObject } from "../../runtime/index.js";
import { dslVersions } from "../../standard/index.js";
import type { Finding } from "../findings.js";

const lines = dslVersions.map((line) => line.replace(".", String.raw`\.`));
const alternatives = lines.join("|");
const supportedDsl = new RegExp(`^(?:${alternatives})\\.(0|[1-9]\\d*)$`);

export function dslVersionFindingsOf(
  document: JsonValue,
): readonly Finding<"dslVersion">[] {
  const isDocument = isJsonObject(document);
  const header = isDocument ? (document.document ?? null) : null;
  const hasHeader = isJsonObject(header);
  const dsl = hasHeader ? header.dsl : null;

  if (typeof dsl !== "string") {
    return [];
  }

  const isSupported = supportedDsl.test(dsl);

  if (isSupported) {
    return [];
  }

  return [
    {
      name: "dslVersion",
      code: "dsl-version",
      pointer: "/document/dsl",
      subject: null,
      details: [dsl],
      import: null,
    },
  ];
}
