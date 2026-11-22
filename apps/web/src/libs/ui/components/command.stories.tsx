import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HouseIcon, PlayIcon, PlusIcon, WorkflowIcon } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./command";

function Palette() {
  return (
    <CommandDialog
      open
      title="Search"
      description="Search workflows, pages and actions"
    >
      <Command>
        <CommandInput placeholder="Type a workflow, a page or an action…" />
        <CommandList>
          <CommandEmpty>Nothing matches.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem>
              <PlusIcon />
              New workflow
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Pages">
            <CommandItem>
              <HouseIcon />
              Home
            </CommandItem>
            <CommandItem>
              <WorkflowIcon />
              Workflows
            </CommandItem>
            <CommandItem>
              <PlayIcon />
              Runs
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

const meta = {
  title: "Design system/Components/Command",
  component: Palette,
} satisfies Meta<typeof Palette>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {};
