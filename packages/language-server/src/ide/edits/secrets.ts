import type { Snapshot } from "../snapshot/index.js";
import { isJsonObject, valueAt } from "../pointers/index.js";
import { inlineYamlOf } from "../yaml-text/index.js";
import { insertionOf, sequenceTextOf } from "./collection-text.js";
import { editableOf, unanalysed } from "./edits.js";
import { fieldSettingOf } from "./field-actions.js";
import type { Editable, Editing, SetField } from "./interfaces.js";

const secretsPointer = "/use/secrets";

export function secretDeclarationOf(snapshot: Snapshot, name: string): Editing {
  const editable = editableOf(snapshot);

  if (editable === null) {
    return unanalysed;
  }

  const declared = valueAt(editable.document, secretsPointer);

  const isList = Array.isArray(declared);

  if (isList) {
    return appendedSecretOf(editable, name, declared.length);
  }

  const use = valueAt(editable.document, "/use");
  const isUseWritten = isJsonObject(use);
  const setting: SetField = isUseWritten
    ? { kind: "setField", pointer: secretsPointer, value: [name] }
    : { kind: "setField", pointer: "/use", value: { secrets: [name] } };

  return fieldSettingOf(editable, setting);
}

function appendedSecretOf(
  editable: Editable,
  name: string,
  length: number,
): Editing {
  const collection = sequenceTextOf(editable, secretsPointer, length);

  if (collection === null) {
    return unanalysed;
  }

  const item = inlineYamlOf(name);
  const forms = { block: `- ${item}\n`, inline: item };
  const insertion = insertionOf(collection, length, forms);

  return { kind: "edited", changes: [insertion], ids: [] };
}
