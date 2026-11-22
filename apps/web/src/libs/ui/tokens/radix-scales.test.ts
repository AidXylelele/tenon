import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";
import radixScales, { scaleEntriesOf } from "./radix-scales";

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
  it("each_step_holds_its_light_and_its_dark_value", () => {
    const light = { ink1: "#000000", ink2: "#111111" };
    const dark = { ink1: "#ffffff", ink2: "#eeeeee" };

    const entries = scaleEntriesOf("ink", light, dark);

    expect(entries).toEqual([
      ["--ink-1", "light-dark(#000000, #ffffff)"],
      ["--ink-2", "light-dark(#111111, #eeeeee)"],
    ]);
  });

  it("a_scale_whose_dark_side_lacks_a_step_is_refused", () => {
    const light = { ink1: "#000000", ink2: "#111111" };
    const dark = { ink1: "#ffffff" };

    const entries = () => scaleEntriesOf("ink", light, dark);

    expect(entries).toThrow(new Error("The dark ink scale has no step 2."));
  });

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
