import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ActivityIcon,
  BellIcon,
  HouseIcon,
  KeyRoundIcon,
  SettingsIcon,
  WebhookIcon,
  WorkflowIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { expect, screen, waitFor } from "storybook/test";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";
import { TooltipProvider } from "./tooltip";

interface PlaceProps {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly current?: boolean;
  readonly running?: number;
}

function Place({ label, href, icon: Icon, current, running }: PlaceProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={current} tooltip={label}>
        <Link href={href}>
          <Icon />
          <span>
            {label}
            {running !== undefined && (
              <span className="sr-only">, {running} runs in progress now</span>
            )}
          </span>
        </Link>
      </SidebarMenuButton>
      {running !== undefined && (
        <SidebarMenuBadge aria-hidden>{running}</SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

function Connect() {
  const labelId = useId();

  return (
    <SidebarGroup>
      <SidebarGroupLabel id={labelId}>Connect</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu aria-labelledby={labelId}>
          <Place label="Webhooks" href="/webhooks" icon={WebhookIcon} />
          <Place label="Notifications" href="/notifications" icon={BellIcon} />
          <Place label="Secrets" href="/secrets" icon={KeyRoundIcon} />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function Navigation({ open }: { readonly open: boolean }) {
  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider defaultOpen={open}>
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Place label="Home" href="/" icon={HouseIcon} />
                  <Place
                    label="Workflows"
                    href="/workflows"
                    icon={WorkflowIcon}
                    current
                  />
                  <Place
                    label="Runs"
                    href="/runs"
                    icon={ActivityIcon}
                    running={10}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <Connect />
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <Place label="Settings" href="/settings" icon={SettingsIcon} />
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="p-4">
          <SidebarTrigger />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

const meta = {
  title: "Design system/Components/Sidebar",
  component: Navigation,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Navigation>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Expanded: Story = { args: { open: true } };

export const CollapsedToIcons: Story = { args: { open: false } };

export const MobileSheetOpen: Story = {
  args: { open: true },
  tags: ["narrow"],
  play: async ({ canvas, userEvent }) => {
    const trigger = await canvas.findByRole("button", { name: "Navigation" });
    await userEvent.click(trigger);

    const home = await screen.findByRole("link", { name: "Home" });
    await waitFor(async () => {
      await expect(home).toHaveFocus();
    });
  },
};
