import type { SemanticModel } from "./model.js";
import type { ExpressionResolution } from "./resolve/index.js";

export function resolutionsOf(
  model: SemanticModel,
  pointer: string,
): readonly ExpressionResolution[] {
  const resolutions = [...model.resolutions.values()];
  const written = resolutions.filter(
    ({ expression }) => expression.pointer === pointer,
  );

  return Object.freeze(written);
}
