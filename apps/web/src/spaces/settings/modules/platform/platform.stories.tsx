import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageBody } from "@/libs/ui/composites/page-body";
import { PlatformPage } from "./platform-page";
import { PROFILE } from "./profile.test-support";

const meta = {
  title: "Spaces/Settings/Platform",
  component: PlatformPage,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/settings/platform" },
    },
  },
  decorators: [
    (Story) => (
      <PageBody>
        <Story />
      </PageBody>
    ),
  ],
  args: { profile: PROFILE },
} satisfies Meta<typeof PlatformPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Platform: Story = {};
