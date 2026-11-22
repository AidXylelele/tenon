import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import type { Capabilities, User } from "@/libs/data-access/types";
import { Button } from "@/libs/ui/components/button";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { PageBody } from "@/libs/ui/composites/page-body";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { AccountMenu } from "./account-menu";
import { CommandPalette } from "./command-palette";
import { ConsoleRoot } from "./console-root";
import { ConsoleSidebar, SidebarLoading } from "./console-sidebar";
import type { FoundWorkflow } from "./found-workflow";
import { Frame } from "./frame";
import { OfflineStrip } from "./offline-strip";

interface FrameStoryProps {
  readonly capabilities: Capabilities;
  readonly defaultOpen: boolean | null;
  readonly inProgress: number;
  readonly reachable: boolean;
  readonly loading: boolean;
}

const ADMINISTRATOR: Capabilities = {
  author: true,
  operator: true,
  administrator: true,
};

const VIEWER: Capabilities = {
  author: false,
  operator: false,
  administrator: false,
};

const ADA: User = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  role: "admin",
};

const FOUND: readonly FoundWorkflow[] = [
  { namespace: "sales", name: "route-lead", on: false, archived: false },
  { namespace: "default", name: "daily-digest", on: true, archived: false },
  { namespace: "billing", name: "run-month-end", on: false, archived: true },
];

const signOut = fn(() => Promise.resolve());
const keepTheme = fn((chosen: string) => Promise.resolve(void chosen));

function FrameStory({
  capabilities,
  defaultOpen,
  inProgress,
  reachable,
  loading,
}: FrameStoryProps) {
  const account = (
    <AccountMenu user={ADA} signOut={signOut} keepTheme={keepTheme} />
  );
  const sidebar = loading ? (
    <SidebarLoading />
  ) : (
    <ConsoleSidebar
      capabilities={capabilities}
      inProgress={inProgress}
      account={account}
    />
  );

  return (
    <TooltipProvider delayDuration={300}>
      <ConsoleRoot defaultOpen={defaultOpen} lastViewport={null}>
        <Frame
          sidebar={sidebar}
          search={
            <CommandPalette capabilities={capabilities} keepTheme={keepTheme} />
          }
          notice={<OfflineStrip reachable={reachable} />}
        >
          <PageBody>
            <PageHeader
              title="route-lead"
              description="Routes a lead to the team that sells in its region."
              actions={<Button>Run</Button>}
            />
            <p>The page&apos;s body stands here, under the top bar.</p>
          </PageBody>
        </Frame>
      </ConsoleRoot>
    </TooltipProvider>
  );
}

function answerWithWorkflows(): () => void {
  const original = window.fetch;
  window.fetch = () => Promise.resolve(Response.json(FOUND));
  return () => {
    window.fetch = original;
  };
}

const meta = {
  title: "Spaces/Shell/Console frame",
  component: FrameStory,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/workflows/sales/route-lead" },
    },
  },
  args: {
    capabilities: ADMINISTRATOR,
    defaultOpen: null,
    inProgress: 10,
    reachable: true,
    loading: false,
  },
} satisfies Meta<typeof FrameStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Expanded: Story = {};

export const CollapsedToIcons: Story = { args: { defaultOpen: false } };

export const ChosenExpanded: Story = { args: { defaultOpen: true } };

export const Viewer: Story = {
  args: { capabilities: VIEWER, inProgress: 1 },
  parameters: {
    nextjs: { navigation: { pathname: "/runs/7c41e2d0-5b0e-4a13-9f2b" } },
  },
};

export const SettingsPage: Story = {
  parameters: { nextjs: { navigation: { pathname: "/settings/account" } } },
};

export const Offline: Story = {
  args: { reachable: false },
  parameters: { nextjs: { navigation: { pathname: "/runs" } } },
};

export const SidebarStillLoading: Story = { args: { loading: true } };

export const SearchOpen: Story = {
  play: async ({ canvas, userEvent }) => {
    const search = await canvas.findByRole("button", { name: "Search" });
    await userEvent.click(search);
  },
};

export const SearchResults: Story = {
  beforeEach: answerWithWorkflows,
  play: async ({ canvas, userEvent }) => {
    const search = await canvas.findByRole("button", { name: "Search" });
    await userEvent.click(search);
    await userEvent.keyboard("ro");
  },
};

export const Narrow: Story = { tags: ["narrow"] };

export const NarrowDrawerOpen: Story = {
  tags: ["narrow"],
  play: async ({ canvas, userEvent }) => {
    const trigger = await canvas.findByRole("button", { name: "Navigation" });
    await userEvent.click(trigger);
  },
};
