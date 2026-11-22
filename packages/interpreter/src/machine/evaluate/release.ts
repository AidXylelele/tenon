import type { Export, Transform } from "../../core/index.js";
import { type Here, withAuthorization } from "../registers/index.js";
import { type Write, updated } from "../transitions/index.js";
import type { View } from "../view.js";

const nothingReleased: readonly Write[] = [];

export function releasedOf(
  term: Transform | Export,
  here: Here,
  view: View,
): readonly Write[] {
  const isLastReader = view.statics.releases.has(term);

  if (!isLastReader) {
    return nothingReleased;
  }

  const address = here.scope.activation;
  const cell = view.store.cellAt(address);
  const released = withAuthorization(cell, null);
  const update = updated(address, released);

  return [update];
}
