import type {
  Diagnostic,
  HostProfile,
  JsonObject,
  JsonValue,
} from "../api/index.js";
import { relativePointerOf } from "../runtime/index.js";
import { standardVersion } from "../standard/index.js";

const filterPointer = "/schedule/on/one";

export const filterProfile: HostProfile = Object.freeze({
  effects: Object.freeze(["listen"] as const),
  authentications: Object.freeze([]),
  processes: Object.freeze([]),
  scriptLanguages: Object.freeze([]),
  asyncApiProtocols: Object.freeze([]),
  mcpTransports: Object.freeze([]),
  schedules: Object.freeze(["on"] as const),
  grants: Object.freeze([]),
  secrets: Object.freeze([]),
});

export function filterDocumentOf(filter: JsonValue): JsonObject {
  return {
    document: {
      dsl: standardVersion,
      namespace: "interpreter",
      name: "filter",
      version: "1.0.0",
    },
    schedule: { on: { one: filter } },
    do: [{ filtered: { set: { filtered: true } } }],
  };
}

export function filterDiagnosticsOf(
  diagnostics: readonly Diagnostic[],
): readonly Diagnostic[] {
  return diagnostics.map(filterDiagnosticOf);
}

function filterDiagnosticOf(diagnostic: Diagnostic): Diagnostic {
  const pointer = relativePointerOf(filterPointer, diagnostic.pointer);

  return {
    code: diagnostic.code,
    message: diagnostic.message,
    pointer,
    range: diagnostic.range,
    subject: diagnostic.subject,
    import: diagnostic.import,
  };
}
