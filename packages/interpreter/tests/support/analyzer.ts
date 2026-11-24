import { readFile } from "node:fs/promises";
import { createAnalyzer } from "../../src/front-end.js";

const location = import.meta.resolve("jq-wasm/jq.wasm");
const engine = await readFile(new URL(location));

export const analyzer = await createAnalyzer(engine);
