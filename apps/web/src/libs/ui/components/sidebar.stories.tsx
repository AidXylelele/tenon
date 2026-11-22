import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HouseIcon, PlayIcon, SettingsIcon, WorkflowIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";
import { TooltipProvider } from "./tooltip";

const PLACES = [
  { label: "Home", icon: HouseIcon, current: false },
  { label: "Workflows", icon: WorkflowIcon, current: true },
  { label: "Runs", icon: PlayIcon, current: false },
  { label: "Settings", icon: SettingsIcon, current: false },
];

function Navigation({ open }: { readonly open: boolean }) {
  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider defaultOpen={open}>
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {PLACES.map((place) => {
                    const Icon = place.icon;
                    return (
                      <SidebarMenuItem key={place.label}>
                        <SidebarMenuButton
                          isActive={place.current}
                          tooltip={place.label}
                        >
                          <Icon />
                          <span>{place.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
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
  },
};
