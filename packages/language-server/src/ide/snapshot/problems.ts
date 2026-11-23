import type { JsonValue } from "interpreter/front-end";
import { holdsWrittenReference } from "../jq-text/index.js";
import {
  childPointerOf,
  isJsonArray,
  isJsonObject,
  valueAt,
} from "../pointers/index.js";
import type {
  AddressDiagnostic,
  Problem,
  Snapshot,
  WrittenReferenceDiagnostic,
} from "./interfaces.js";
import { sourceOf } from "./reads.js";

const namespacePointer = "/document/namespace";

const namePointer = "/document/name";

const codeFields: readonly string[] = [
  "/run/script/code",
  "/run/shell/command",
];

const writtenReference =
  "This ${ … } is inside other text, so it is sent as written, not as data. Use Insert data to put data here.";

export function problemsOf(snapshot: Snapshot): readonly Problem[] {
  const diagnostics = snapshot.analysis.diagnostics;
  const address = addressProblemOf(snapshot);
  const written = writtenReferencesOf(snapshot);
  const addressed = address === null ? [] : [address];

  return [...diagnostics, ...addressed, ...written];
}

function writtenReferencesOf(
  snapshot: Snapshot,
): readonly WrittenReferenceDiagnostic[] {
  const source = sourceOf(snapshot.analysis);

  if (source === null) {
    return [];
  }

  const texts = textsIn(source.document, "");
  const written = texts.filter(
    ([pointer, text]) => holdsWrittenReference(text) && !isCodeField(pointer),
  );

  return written.map(([pointer, text]) => {
    const range = source.positions?.rangeOf(pointer) ?? null;

    return {
      code: "written-reference",
      message: writtenReference,
      pointer,
      range,
      subject: text,
      import: null,
    };
  });
}

function textsIn(
  value: JsonValue,
  pointer: string,
): readonly (readonly [string, string])[] {
  if (typeof value === "string") {
    return [[pointer, value]];
  }

  if (isJsonArray(value)) {
    return value.flatMap((item, index) =>
      textsIn(item, childPointerOf(pointer, String(index))),
    );
  }

  if (isJsonObject(value)) {
    return Object.entries(value).flatMap(([key, item]) =>
      textsIn(item, childPointerOf(pointer, key)),
    );
  }

  return [];
}

function isCodeField(pointer: string): boolean {
  return codeFields.some((field) => pointer.endsWith(field));
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
