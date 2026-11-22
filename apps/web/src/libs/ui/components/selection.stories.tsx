import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Label } from "./label";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Switch } from "./switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

function SelectionStates() {
  return (
    <div className="flex max-w-3xl flex-col gap-8 p-6">
      <section className="flex flex-col gap-3">
        <h2 className="heading-2">Segmented control</h2>
        <ToggleGroup type="single" defaultValue="flow" aria-label="View">
          <ToggleGroupItem value="flow">Flow</ToggleGroupItem>
          <ToggleGroupItem value="code">Code</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="single" defaultValue="7d" aria-label="Period">
          <ToggleGroupItem value="24h">24 h</ToggleGroupItem>
          <ToggleGroupItem value="7d">7 d</ToggleGroupItem>
          <ToggleGroupItem value="30d">30 d</ToggleGroupItem>
          <ToggleGroupItem value="all" disabled>
            All
          </ToggleGroupItem>
        </ToggleGroup>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="heading-2">Tabs</h2>
        <Tabs defaultValue="runs">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
          </TabsList>
          <TabsContent value="runs">Runs of this workflow.</TabsContent>
        </Tabs>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="heading-2">Switch</h2>
        <div className="flex items-center gap-2">
          <Switch id="on" defaultChecked />
          <Label htmlFor="on">Starts automatically</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="off" />
          <Label htmlFor="off">Starts automatically</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="disabled" disabled />
          <Label htmlFor="disabled">Starts automatically</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="invalid" aria-invalid />
          <Label htmlFor="invalid">Accept the terms</Label>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="heading-2">Radio group</h2>
        <RadioGroup defaultValue="schedule" aria-label="How it starts">
          <div className="flex items-center gap-2">
            <RadioGroupItem id="hand" value="hand" />
            <Label htmlFor="hand">By hand</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="schedule" value="schedule" />
            <Label htmlFor="schedule">On a schedule</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="event" value="event" disabled />
            <Label htmlFor="event">On an event</Label>
          </div>
        </RadioGroup>
      </section>
    </div>
  );
}

const meta = {
  title: "Design system/Components/Selection",
  component: SelectionStates,
} satisfies Meta<typeof SelectionStates>;

export default meta;

type Story = StoryObj<typeof meta>;

export const States: Story = {};
