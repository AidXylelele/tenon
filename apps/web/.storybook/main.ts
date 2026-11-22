import type { StorybookConfig } from "@storybook/nextjs-vite";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-themes"],
  framework: "@storybook/nextjs-vite",
  core: { disableTelemetry: true },
  viteFinal: (vite) => mergeConfig(vite, { worker: { format: "es" } }),
};

export default config;
