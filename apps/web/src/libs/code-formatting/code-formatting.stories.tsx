import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useState } from "react";
import type { ScriptLanguage } from "@/libs/codemirror/interfaces";
import { formatScript } from "./format-script";

interface FormattingProbeProps {
  readonly language: ScriptLanguage;
  readonly text: string;
}

function FormattingProbe({ language, text }: FormattingProbeProps) {
  const [outcome, setOutcome] = useState("Formatting");

  useEffect(() => {
    let current = true;

    function show(shown: string): void {
      if (current) setOutcome(shown);
    }

    formatScript(language, text).then(
      (formatting) => {
        const shown = JSON.stringify(formatting);
        show(shown);
      },
      (failure: unknown) => {
        const shown = String(failure);
        show(shown);
      },
    );

    return () => {
      current = false;
    };
  }, [language, text]);

  return <output aria-label="Formatting">{outcome}</output>;
}

const meta = {
  component: FormattingProbe,
} satisfies Meta<typeof FormattingProbe>;

export default meta;

type Story = StoryObj<typeof meta>;

export const JavaScript: Story = {
  args: { language: "javascript", text: "const total = [1,2].map(n=>n*2)" },
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
