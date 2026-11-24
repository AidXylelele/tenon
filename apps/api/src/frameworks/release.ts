import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const manifest = require("../../package.json") as { readonly version: string };

export const RELEASE_VERSION = manifest.version;
