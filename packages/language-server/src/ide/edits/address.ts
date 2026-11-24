import type { DraftAddress, Snapshot } from "../snapshot/index.js";
import { inTextOrder } from "./collection-text.js";
import { editableTextOf, unreadable } from "./edits.js";
import { fieldSettingOf } from "./field-actions.js";
import type { Editing, SetField } from "./interfaces.js";

export function addressSettingOf(
  snapshot: Snapshot,
  draft: DraftAddress,
): Editing {
  const editable = editableTextOf(snapshot);

  if (editable === null) {
    return unreadable;
  }

  const settings: readonly SetField[] = [
    {
      kind: "setField",
      pointer: "/document/namespace",
      value: draft.namespace,
    },
    { kind: "setField", pointer: "/document/name", value: draft.name },
  ];
  const editings = settings.map((setting) => fieldSettingOf(editable, setting));
  const changes = editings.flatMap((editing) => {
    switch (editing.kind) {
      case "edited":
        return editing.changes;
      case "refused":
        return [];
    }
  });
  const ordered = inTextOrder(changes);

  return { kind: "edited", changes: ordered, ids: [] };
}
