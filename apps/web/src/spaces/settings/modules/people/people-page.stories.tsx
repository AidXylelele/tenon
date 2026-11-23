import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { PageBody } from "@/libs/ui/composites/page-body";
import { PeoplePage } from "./people-page";

const meta = {
  title: "Spaces/Settings/People",
  component: PeoplePage,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/settings/invitations" },
    },
  },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <PageBody>
          <Story />
        </PageBody>
      </TooltipProvider>
    ),
  ],
  args: {
    people: [
      {
        id: "u-1",
        email: "ada@example.com",
        name: "Ada Lovelace",
        role: "admin",
        status: "active",
        since: "2026-10-01T09:00:00.000Z",
      },
      {
        id: "u-2",
        email: "grace@example.com",
        name: "Grace Hopper",
        role: "editor",
        status: "active",
        since: "2026-10-14T11:30:00.000Z",
      },
      {
        id: "u-3",
        email: "alan@example.com",
        name: null,
        role: "viewer",
        status: "suspended",
        since: "2026-11-02T16:00:00.000Z",
      },
    ],
    list: [
      {
        id: "i-1",
        email: "katherine@example.com",
        role: "editor",
        status: "pending",
        expiresAt: "2026-11-30T09:00:00.000Z",
        createdAt: "2026-11-23T09:00:00.000Z",
      },
    ],
  },
} satisfies Meta<typeof PeoplePage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const People: Story = {};
