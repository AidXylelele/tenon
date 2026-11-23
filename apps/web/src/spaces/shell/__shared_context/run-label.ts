const RUN_ID_SHOWN = 8;

export function runLabelOf(id: string): string {
  const shown = id.slice(0, RUN_ID_SHOWN);
  return `Run ${shown}`;
}
