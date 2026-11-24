import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { PageBody } from "@/libs/ui/composites/page-body";
import { SecretsPage } from "./secrets-page";
import { SECRETS } from "./secrets.test-support";

const meta = {
  title: "Spaces/Secrets/Secrets",
  component: SecretsPage,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/secrets" } },
  },
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={300}>
        <PageBody>
          <Story />
        </PageBody>
      </TooltipProvider>
    ),
  ],
  args: { secrets: SECRETS },
} satisfies Meta<typeof SecretsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const List: Story = {};

export const NoSecrets: Story = {
  args: { secrets: [] },
};

export const NewSecret: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/secrets", query: { new: "1" } },
    },
  },
};
