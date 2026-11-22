import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { cn } from "cn";

interface Sample {
  readonly token: string;
  readonly use: string;
  readonly className: string;
}

const SPACES = [1, 2, 3, 4, 5, 6, 7, 8];

const RADII: readonly Sample[] = [
  { token: "--radius-sm", use: "badges, checkboxes", className: "rounded-sm" },
  {
    token: "--radius-md",
    use: "buttons, inputs, menu items",
    className: "rounded-md",
  },
  {
    token: "--radius-lg",
    use: "cards, panels, popovers",
    className: "rounded-lg",
  },
  { token: "--radius-xl", use: "dialogs", className: "rounded-xl" },
];

const LEVELS: readonly Sample[] = [
  { token: "Level 0", use: "cards, tables, step cards", className: "border" },
  {
    token: "Level 1 · --shadow-1",
    use: "popovers, menus, toasts",
    className: "bg-surface-raised shadow-overlay",
  },
  {
    token: "Level 2 · --shadow-2",
    use: "dialogs, sheets",
    className: "bg-surface-raised shadow-dialog",
  },
];

const HEIGHTS: readonly Sample[] = [
  {
    token: "--control-height-sm",
    use: "dense table actions",
    className: "h-7",
  },
  { token: "--control-height", use: "default", className: "h-8" },
  { token: "--control-height-lg", use: "sign-in pages", className: "h-10" },
];

function Radius({ sample }: { readonly sample: Sample }) {
  const shape = cn("size-16 border border-control bg-subtle", sample.className);

  return (
    <div className="flex flex-col gap-1">
      <span className={shape} />
      <code className="font-mono text-code">{sample.token}</code>
      <span className="text-caption text-muted-foreground">{sample.use}</span>
    </div>
  );
}

function Level({ sample }: { readonly sample: Sample }) {
  const card = cn(
    "flex h-24 w-56 flex-col justify-end rounded-lg p-3",
    sample.className,
  );

  return (
    <div className={card}>
      <span className="font-semibold">{sample.token}</span>
      <span className="text-caption text-muted-foreground">{sample.use}</span>
    </div>
  );
}

function Height({ sample }: { readonly sample: Sample }) {
  const control = cn(
    "flex w-40 items-center rounded-md border border-control px-3",
    sample.className,
  );

  return (
    <div className="flex flex-col gap-1">
      <span className={control}>{sample.use}</span>
      <code className="font-mono text-code">{sample.token}</code>
    </div>
  );
}

function SpaceAndShape() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <section className="flex flex-col gap-2">
        <h2 className="heading-2">Spacing, 4 px base</h2>
        {SPACES.map((step) => {
          const width = `var(--space-${String(step)})`;
          const token = `--space-${String(step)}`;
          return (
            <div key={step} className="flex items-center gap-3">
              <code className="w-20 font-mono text-code">{token}</code>
              <span className="h-4 bg-accent-solid" style={{ width }} />
            </div>
          );
        })}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="heading-2">Radius</h2>
        <div className="flex flex-wrap gap-4">
          {RADII.map((sample) => (
            <Radius key={sample.token} sample={sample} />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="heading-2">Elevation</h2>
        <div className="flex flex-wrap gap-6 bg-subtle p-6">
          {LEVELS.map((sample) => (
            <Level key={sample.token} sample={sample} />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="heading-2">Control heights</h2>
        <div className="flex flex-wrap items-end gap-4">
          {HEIGHTS.map((sample) => (
            <Height key={sample.token} sample={sample} />
          ))}
        </div>
      </section>
    </div>
  );
}

const meta = {
  title: "Design system/Space and shape",
  component: SpaceAndShape,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SpaceAndShape>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Scales: Story = {};
