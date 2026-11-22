export interface Line {
  readonly text: string;
  readonly children: readonly Line[];
}

export function lineOf(text: string, children: readonly Line[]): Line {
  return { text, children };
}

export function leafOf(text: string): Line {
  return { text, children: [] };
}

export function labelledOf(label: string, text: string): Line {
  return leafOf(`${label} ${text}`);
}

export function groupOf(label: string, children: readonly Line[]): Line {
  return { text: label, children };
}
