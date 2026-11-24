import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { transformSync } from "@swc/core";

const options = {
  jsc: {
    parser: { syntax: "typescript", decorators: true },
    transform: { legacyDecorator: true, decoratorMetadata: true },
    target: "es2023",
  },
  module: { type: "es6" },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    const typed =
      context.parentURL?.endsWith(".ts") && specifier.endsWith(".js");

    if (!typed) return nextResolve(specifier, context);

    const url = new URL(specifier, context.parentURL);
    const source = url.href.replace(/\.js$/, ".ts");
    const compiled = existsSync(fileURLToPath(url));

    if (compiled || !existsSync(fileURLToPath(source)))
      return nextResolve(specifier, context);

    return nextResolve(source, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith(".ts")) return nextLoad(url, context);

    const filename = fileURLToPath(url);
    const text = readFileSync(filename, "utf8");
    const { code } = transformSync(text, { ...options, filename });
    return { format: "module", source: code, shortCircuit: true };
  },
});
