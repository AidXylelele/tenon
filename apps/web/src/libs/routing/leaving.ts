import type { Hold } from "./interfaces";

let hold: Hold | null = null;

export function holdLeaving(next: Hold): () => void {
  hold = next;
  return () => {
    if (hold === next) hold = null;
  };
}

export function heldLeaving(href: string): boolean {
  if (hold === null) return false;

  hold(href);
  return true;
}
