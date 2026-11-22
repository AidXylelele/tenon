import type { Meta, StoryObj } from "@storybook/nextjs-vite";

interface Token {
  readonly name: string;
  readonly use: string;
}

interface TokenGroup {
  readonly title: string;
  readonly tokens: readonly Token[];
}

const SCALES = ["slate", "iris", "grass", "amber", "red", "blue"];
const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const GROUPS: readonly TokenGroup[] = [
  {
    title: "Surfaces",
    tokens: [
      { name: "--bg", use: "page" },
      { name: "--bg-subtle", use: "sidebar, canvas, table header" },
      { name: "--surface", use: "cards, inputs, step cards" },
      { name: "--surface-raised", use: "popovers, menus, dialogs" },
      { name: "--hover", use: "hovered rows and items" },
      { name: "--selected", use: "selected rows" },
      { name: "--track", use: "segmented control track" },
      { name: "--thumb", use: "segmented control thumb" },
    ],
  },
  {
    title: "Text and lines",
    tokens: [
      { name: "--text", use: "body text" },
      { name: "--text-muted", use: "secondary text, placeholders" },
      { name: "--text-faint", use: "disabled text" },
      { name: "--border", use: "dividers, card edges" },
      { name: "--border-strong", use: "step card edges" },
      { name: "--control-border", use: "boundary of inputs" },
    ],
  },
  {
    title: "Accent",
    tokens: [
      { name: "--accent-solid", use: "the primary button" },
      { name: "--accent-solid-hover", use: "the primary button, hovered" },
      { name: "--accent-text", use: "links, current tab" },
      { name: "--accent-soft", use: "current place, selection" },
      { name: "--accent-border", use: "accent chip edge" },
      { name: "--focus-ring", use: "focus ring" },
    ],
  },
  {
    title: "Status",
    tokens: [
      { name: "--success-text", use: "success word and icon" },
      { name: "--success-soft", use: "success banner" },
      { name: "--warning-text", use: "warning word and icon" },
      { name: "--warning-soft", use: "warning banner" },
      { name: "--danger-text", use: "danger word and icon" },
      { name: "--danger-soft", use: "danger banner, destructive button" },
      { name: "--info-text", use: "info word and icon" },
      { name: "--info-soft", use: "info banner" },
    ],
  },
  {
    title: "Code",
    tokens: [
      { name: "--code-keyword", use: "YAML keys, JS keywords" },
      { name: "--code-string", use: "strings" },
      { name: "--code-number", use: "numbers, booleans" },
      { name: "--code-property", use: "properties, functions" },
      { name: "--code-comment", use: "comments" },
      { name: "--code-expression", use: "expressions" },
    ],
  },
];

function Scale({ name }: { readonly name: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-caption text-muted-foreground">{name}</span>
      {STEPS.map((step) => {
        const variable = `var(--${name}-${String(step)})`;
        const label = `${name} ${String(step)}`;
        return (
          <span
            key={step}
            role="img"
            aria-label={label}
            title={label}
            className="size-8 rounded-sm border"
            style={{ backgroundColor: variable }}
          />
        );
      })}
    </div>
  );
}

function Swatch({ token }: { readonly token: Token }) {
  const fill = `var(${token.name})`;

  return (
    <li className="flex items-center gap-3">
      <span
        className="size-8 shrink-0 rounded-md border"
        style={{ backgroundColor: fill }}
      />
      <span className="flex flex-col">
        <code className="font-mono text-code">{token.name}</code>
        <span className="text-caption text-muted-foreground">{token.use}</span>
      </span>
    </li>
  );
}

function ColourTokens() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <section className="flex flex-col gap-2">
        <h2 className="heading-2">Radix scales</h2>
        {SCALES.map((name) => (
          <Scale key={name} name={name} />
        ))}
      </section>
      {GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          <h2 className="heading-2">{group.title}</h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {group.tokens.map((token) => (
              <Swatch key={token.name} token={token} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const meta = {
  title: "Design system/Colour",
  component: ColourTokens,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ColourTokens>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Tokens: Story = {};
