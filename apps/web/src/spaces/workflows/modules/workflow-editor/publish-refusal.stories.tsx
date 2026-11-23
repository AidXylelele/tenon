import { yaml } from "@codemirror/lang-yaml";
import { lintGutter } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useMemo, useRef, useState } from "react";
import { fn } from "storybook/test";
import type { Diagnostic } from "vscode-languageserver-protocol";
import { CodeMirrorView } from "@/libs/codemirror/codemirror-view";
import { tokenTheme } from "@/libs/codemirror/theme";
import type { Problem } from "@/libs/data-access/problem";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import type { WorkflowSession } from "@/operations/workflow-language";
import { EditorToolbar } from "./editor-toolbar";
import type { Publication } from "./interfaces";
import { markPlatformProblems } from "./platform-problems";
import { ProblemsPanel } from "./problems-panel";
import { PublishBar } from "./publish-bar";

const TEXT = `document:
  dsl: 1.0.0
  namespace: sales
  name: digest
  version: 1.0.0
schedule:
  cron: "0 18 30 2 *"
do:
  - fetch:
      call: http
      with:
        method: get
        endpoint: https://api.example.com/orders
`;

const NEVER_FIRES =
  "The schedule 0 18 30 2 * never fires: February has no 30th day, so the workflow would never start";

const REFUSAL: Problem = {
  type: "urn:problem:definition.invalid",
  title: "The workflow definition is invalid",
  status: 422,
  detail: NEVER_FIRES,
  errors: [
    { pointer: "/schedule/cron", detail: NEVER_FIRES, line: 7, column: 9 },
  ],
  retryAfter: null,
};

const REFUSED: Publication = { kind: "refused", problem: REFUSAL };

const SESSION = {
  document: () =>
    Promise.resolve({
      kind: "document",
      version: 1,
      document: { document: { version: "1.0.0" } },
    }),
  rangesOf: () => Promise.resolve({ version: 1, ranges: [null] }),
} as unknown as WorkflowSession;

function RefusedPublish() {
  const view = useRef<EditorView | null>(null);
  const [problems, setProblems] = useState<readonly Diagnostic[]>([]);
  const [shown, setShown] = useState(false);
  const extensions = useMemo(() => [yaml(), tokenTheme(), lintGutter()], []);

  function refuse(found: readonly Diagnostic[]) {
    setProblems(found);

    if (view.current !== null) markPlatformProblems(view.current, found);
  }

  return (
    <div className="flex h-screen flex-col">
      <EditorToolbar
        title="Daily digest"
        back="/workflows"
        status="Draft saved"
        shown="code"
        problems={shown ? problems.length : 0}
        testing={false}
        testFirst={false}
        onShown={fn()}
        onProblems={fn()}
        onTest={fn()}
        onLoad={fn()}
        onDownload={fn()}
        discard={null}
      >
        <PublishBar
          session={SESSION}
          problems={problems.length}
          onPlatformProblems={refuse}
          publish={() => Promise.resolve(REFUSED)}
          onPublished={() => Promise.resolve()}
          currentVersion={null}
          onUseVersion={fn()}
          onShowProblems={() => {
            setShown(true);
          }}
          title="Daily digest"
          startsByItself
          tested
          ready
          onTest={fn()}
          changesOf={() => Promise.resolve({ kind: "read", changes: [] })}
          setVersion={() => Promise.resolve()}
          turnOn={() => Promise.resolve({ ok: true, value: undefined })}
        />
      </EditorToolbar>
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_400px]">
        <CodeMirrorView
          doc={TEXT}
          extensions={extensions}
          label="Code view (YAML)"
          className="h-full min-h-0 [&_.cm-editor]:h-full"
          onView={(editor) => {
            view.current = editor;
          }}
        />
        <aside className="flex min-h-0 flex-col border-l">
          {shown && (
            <ProblemsPanel
              problems={problems}
              onShow={fn()}
              fixesFor={() => []}
              onBack={fn()}
            />
          )}
        </aside>
      </main>
    </div>
  );
}

const meta = {
  component: RefusedPublish,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RefusedPublish>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RefusedSchedule: Story = {};
