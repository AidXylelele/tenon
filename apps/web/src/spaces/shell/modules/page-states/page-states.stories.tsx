import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { PageError } from "./page-error";
import { PageNotFound } from "./page-not-found";

const meta = {
  title: "Spaces/Shell/Page states",
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/runs/not-a-uuid" },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotFound: Story = {
  render: () => <PageNotFound />,
};

export const CouldNotLoad: Story = {
  render: () => {
    const failed = Object.assign(new Error("Tenon did not answer"), {
      digest: "4211",
    });
    return <PageError error={failed} retry={fn()} />;
  },
};
