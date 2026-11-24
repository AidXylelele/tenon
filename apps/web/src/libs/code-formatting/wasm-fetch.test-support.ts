import { readFile } from "node:fs/promises";

const SERVED_FILE = /^\/@fs/;

export async function fetchFromDisk(address: string | URL): Promise<Response> {
  const { pathname } = new URL(address);
  const served = decodeURIComponent(pathname);
  const path = served.replace(SERVED_FILE, "");
  const bytes = await readFile(path);
  const headers = { "Content-Type": "application/wasm" };
  return new Response(bytes, { headers });
}

export function missing(): Promise<Response> {
  const response = new Response(null, { status: 404 });
  return Promise.resolve(response);
}
