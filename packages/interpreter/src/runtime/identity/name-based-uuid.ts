import { v5 } from "uuid";

const uuidBytes = 16;

const fractionBytes = 6;

export function derivedUuidOf(instance: string, effect: string): string {
  const name = nameOf(instance, effect);
  return v5(name, v5.URL);
}

export function derivedFractionOf(instance: string, effect: string): number {
  const name = nameOf(instance, effect);
  const bytes = Buffer.alloc(uuidBytes);
  const digest = v5(name, v5.URL, bytes);
  const head = digest.readUIntBE(0, fractionBytes);

  return head / 2 ** (fractionBytes * 8);
}

function nameOf(instance: string, effect: string): string {
  const name = `${instance}\n${effect}`;
  return name.toWellFormed();
}
