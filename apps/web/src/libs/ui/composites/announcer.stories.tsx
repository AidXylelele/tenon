import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "../components/button";
import { Announcer, useAnnounce } from "./announcer";

function AddStep() {
  const announce = useAnnounce();

  return (
    <Button
      variant="outline"
      onClick={() => {
        announce("Step added after Fetch invoices");
      }}
    >
      Add a step
    </Button>
  );
}

function Console() {
  return (
    <Announcer>
      <div className="p-6">
        <AddStep />
      </div>
    </Announcer>
  );
}

const meta = {
  title: "Design system/Components/Announcer",
  component: Console,
} satisfies Meta<typeof Console>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
