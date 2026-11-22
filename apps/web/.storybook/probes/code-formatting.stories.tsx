import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useState } from "react";
import { formatScript } from "../../src/libs/code-formatting/format-script";
import type { ScriptLanguage } from "../../src/libs/codemirror/interfaces";

interface FormattingProbeProps {
  readonly language: ScriptLanguage;
  readonly text: string;
}

function FormattingProbe({ language, text }: FormattingProbeProps) {
  const [outcome, setOutcome] = useState("Formatting");

  useEffect(() => {
    formatScript(language, text).then(
      (formatting) => {
        const shown = JSON.stringify(formatting);
        setOutcome(shown);
      },
      (failure: unknown) => {
        const shown = String(failure);
        setOutcome(shown);
      },
    );
  }, [language, text]);

  return <output aria-label="Formatting">{outcome}</output>;
}

const meta = {
  title: "probes/code-formatting",
  component: FormattingProbe,
} satisfies Meta<typeof FormattingProbe>;

export default meta;

type Story = StoryObj<typeof meta>;

export const JavaScript: Story = {
  args: { language: "js", text: "const total = [1,2].map(n=>n*2)" },
};

export const Python: Story = {
  args: {
    language: "python",
    text: "import json\nprint( json.dumps({'score':1}) )",
  },
};

export const PythonThatDoesNotParse: Story = {
  args: {
    language: "python",
    text: 'import json\nscore = 1\nprint(json.dumps({"score": score})',
  },
};
