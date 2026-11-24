import type { StorybookConfig } from "@storybook/nextjs-vite";
import { mergeConfig } from "vite";
import { yamlText } from "../vite-yaml-text.mjs";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-themes"],
  framework: "@storybook/nextjs-vite",
  core: { disableTelemetry: true },
  viteFinal: (vite) =>
    mergeConfig(vite, { plugins: [yamlText()], worker: { format: "es" } }),
};

export default config;
