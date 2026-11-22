import { valueAt } from "../pointers/index.js";
import type { AddressDiagnostic, Problem, Snapshot } from "./interfaces.js";
import { sourceOf } from "./reads.js";

const namespacePointer = "/document/namespace";

const namePointer = "/document/name";

export function problemsOf(snapshot: Snapshot): readonly Problem[] {
  const diagnostics = snapshot.analysis.diagnostics;
  const address = addressProblemOf(snapshot);

  if (address === null) {
    return diagnostics;
  }

  return [...diagnostics, address];
}

function addressProblemOf(snapshot: Snapshot): AddressDiagnostic | null {
  const draft = snapshot.draft;
  const source = sourceOf(snapshot.analysis);

  if (draft === null || source === null) {
    return null;
  }

  const namespace = valueAt(source.document, namespacePointer);
  const name = valueAt(source.document, namePointer);

  if (typeof namespace !== "string" || typeof name !== "string") {
    return null;
  }

  const isOtherNamespace = namespace !== draft.namespace;
  const isOtherName = name !== draft.name;

  if (!isOtherNamespace && !isOtherName) {
    return null;
  }

  const pointer = isOtherNamespace ? namespacePointer : namePointer;
  const range = source.positions?.rangeOf(pointer) ?? null;
  const address = `${draft.namespace}/${draft.name}`;
  const message = `This draft is ${address}, and the document names ${namespace}/${name}; publishing it here is refused.`;

  return {
    code: "draft-address",
    message,
    pointer,
    range,
    subject: address,
    import: null,
  };
}
