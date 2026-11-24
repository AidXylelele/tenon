import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview, ReactRenderer } from "@storybook/nextjs-vite";
import { geistMono, geistSans } from "../src/libs/ui/fonts";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    nextjs: { appDirectory: true },
  },
  decorators: [
    withThemeByDataAttribute<ReactRenderer>({
      themes: { light: "light", dark: "dark" },
      defaultTheme: "light",
      attributeName: "data-theme",
    }),
  ],
  beforeAll() {
    document.documentElement.classList.add(
      geistSans.variable,
      geistMono.variable,
      "antialiased",
    );
  },
};

export default preview;
