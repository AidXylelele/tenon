import type { Plugin } from "vite";

export function yamlText(): Plugin {
  return {
    name: "yaml-text",
    transform(code, id) {
      if (!id.endsWith(".yaml")) return null;

      const text = JSON.stringify(code);
      return { code: `export default ${text};`, map: null };
    },
  };
}
