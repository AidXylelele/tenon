import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx", "./probes/*.stories.tsx"],
  addons: ["@storybook/addon-themes"],
  framework: "@storybook/nextjs-vite",
  core: { disableTelemetry: true },
};

export default config;
