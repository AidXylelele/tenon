import { yaml } from "@codemirror/lang-yaml";
import type { Extension } from "@codemirror/state";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CodeMirrorView } from "./codemirror-view";
import { scriptLanguage } from "./script-language";
import { tokenTheme } from "./theme";

const WORKFLOW = `document:
  dsl: '1.1.0'
  name: daily-digest # every morning
do:
  - fetch:
      call: http
      with:
        method: get
        retries: 3
        enabled: true
`;

const SCRIPT = `// Normalize the names
const result = people.map((person) => ({ ...person, name: person.name.trim() }));
console.log(JSON.stringify(result));
`;

const PYTHON = `import json  # the score of a lead
score = 10 if lead.get("email") else 0
print(json.dumps({"score": score}))
`;

const YAML_LOOK: Extension = [yaml(), tokenTheme()];
const SCRIPT_LOOK: Extension = [scriptLanguage("javascript"), tokenTheme()];
const PYTHON_LOOK: Extension = [scriptLanguage("python"), tokenTheme()];

const meta = {
  component: CodeMirrorView,
  args: {
    readOnly: true,
    className: "m-6 h-56 overflow-hidden rounded-lg border",
  },
} satisfies Meta<typeof CodeMirrorView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Workflow: Story = {
  args: { doc: WORKFLOW, extensions: YAML_LOOK, label: "Workflow text" },
};

export const JavaScript: Story = {
  args: { doc: SCRIPT, extensions: SCRIPT_LOOK, label: "Script code" },
};

export const Python: Story = {
  args: { doc: PYTHON, extensions: PYTHON_LOOK, label: "Script code" },
};
