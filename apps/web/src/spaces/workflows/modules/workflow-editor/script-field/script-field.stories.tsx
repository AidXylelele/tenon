import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import type { RunScriptLanguage } from "./interfaces";
import { ScriptField } from "./script-field";

interface PlaygroundProps {
  readonly language: RunScriptLanguage;
  readonly value: string;
  readonly expanded: boolean;
}

const JS_RAW = `const result = people.map((person) => ({ ...person, name: person.name.trim().toLowerCase() }));
console.log(JSON.stringify(result));
`;

const JS_SHORT = `const ids=people.map(p=>p.id)
console.log(JSON.stringify(ids))`;

const PY_UNCLOSED = `import json
score = 10 if lead.get("email") else 0
print(json.dumps({"score": score})`;

const PY_SCORE = `import json
score = 10 if lead.get("email") else 0
print(json.dumps({"score": score}))`;

const PANEL_FIELD = "w-92";

const WIDE_PANEL_FIELD = "w-152";

function ScriptFieldPlayground({ language, value, expanded }: PlaygroundProps) {
  const [code, setCode] = useState(value);
  const [wide, setWide] = useState(expanded);
  const width = wide ? WIDE_PANEL_FIELD : PANEL_FIELD;

  return (
    <TooltipProvider delayDuration={300}>
      <div className={width}>
        <ScriptField
          language={language}
          label="Code"
          value={code}
          expanded={wide}
          onChange={setCode}
          onExpandedChange={setWide}
        />
      </div>
    </TooltipProvider>
  );
}

const meta = {
  component: ScriptFieldPlayground,
  args: { language: "js", value: JS_RAW, expanded: false },
} satisfies Meta<typeof ScriptFieldPlayground>;

export default meta;

type Story = StoryObj<typeof meta>;

export const JavaScriptFormatted: Story = {
  args: { value: JS_SHORT },
  play: async ({ canvas, userEvent }) => {
    const format = await canvas.findByRole("button", { name: "Format" });
    await userEvent.click(format);
    await canvas.findByText("Formatted with Prettier");
  },
};

export const PythonWithAProblem: Story = {
  args: { language: "python", value: PY_UNCLOSED },
  play: async ({ canvas, userEvent }) => {
    const format = await canvas.findByRole("button", { name: "Format" });
    await userEvent.click(format);
    await canvas.findByText(/^Fix line 3 first/);
  },
};

export const Expanded: Story = {
  args: { language: "python", value: PY_SCORE, expanded: true },
};
