import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";
import radixScales from "./radix-scales";

async function compiledCss(): Promise<string> {
  const compiler = await compile('@plugin "./radix-scales";', {
    loadModule: () => {
      const loaded = {
        path: "radix-scales.ts",
        base: ".",
        module: radixScales,
      };
      return Promise.resolve(loaded);
    },
  });
  return compiler.build([]);
}

describe("radix colour scales as css variables", () => {
  it("the_plugin_sets_the_six_scales_of_the_design_on_the_root", async () => {
    const css = await compiledCss();

    const nines = [...css.matchAll(/--([a-z]+)-9: (light-dark\([^)]*\))/g)].map(
      ([, scale, value]) => `${String(scale)} ${String(value)}`,
    );
    expect(nines).toEqual([
      "slate light-dark(#8b8d98, #696e77)",
      "iris light-dark(#5b5bd6, #5b5bd6)",
      "grass light-dark(#46a758, #46a758)",
      "amber light-dark(#ffc53d, #ffc53d)",
      "red light-dark(#e5484d, #e5484d)",
      "blue light-dark(#0090ff, #0090ff)",
    ]);
  });
});
