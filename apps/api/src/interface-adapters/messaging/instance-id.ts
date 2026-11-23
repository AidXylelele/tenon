import { createHash } from "node:crypto";

const VERSION = "8";
const VARIANT = "8";

export function instanceIdOf(slot: string): string {
  const hex = createHash("sha256").update(slot).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    VERSION + hex.slice(13, 16),
    VARIANT + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}
