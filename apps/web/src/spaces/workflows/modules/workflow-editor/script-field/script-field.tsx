"use client";

import { isolateHistory } from "@codemirror/commands";
import { setDiagnostics } from "@codemirror/lint";
import type { EditorView, ViewUpdate } from "@codemirror/view";
import {
  Loader2Icon,
  MaximizeIcon,
  MinimizeIcon,
  WandSparklesIcon,
} from "lucide-react";
import {
  type JSX,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { CodeStatusLine } from "@/libs/codemirror/code-status-line";
import { CodeMirrorView } from "@/libs/codemirror/codemirror-view";
import { isChangedHere, takeOwnersText } from "@/libs/codemirror/owned-text";
import {
  codeProblemsOf,
  lintDiagnosticsOf,
} from "@/libs/language-client/codemirror-diagnostics";
import { Button } from "@/libs/ui/components/button";
import { Kbd } from "@/libs/ui/components/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/libs/ui/components/tooltip";
import { formatScript } from "@/libs/code-formatting/format-script";
import { formatWordsOf } from "./formatting";
import type {
  FormatOutcome,
  FormatState,
  ScriptFieldProps,
} from "./interfaces";
import { SCRIPT_LANGUAGES } from "./languages";

interface FormatButtonProps {
  readonly running: boolean;
  readonly onFormat: () => void;
}

const IDLE: FormatState = { kind: "idle" };

const RUNNING: FormatState = { kind: "running" };

const OUTDATED: FormatOutcome = { kind: "outdated" };

const NARROW = "min-h-35";

const EXPANDED = "min-h-105";

export function ScriptField({
  language,
  label,
  value,
  problems,
  expanded,
  onChange,
  onExpandedChange,
}: ScriptFieldProps): JSX.Element {
  const view = useRef<EditorView>(null);
  const [formatting, setFormatting] = useState(IDLE);
  const settings = SCRIPT_LANGUAGES[language];
  const running = formatting.kind === "running";
  const isTold = formatting.kind === "told";
  const told = isTold ? formatting.words : "";
  const height = expanded ? EXPANDED : NARROW;
  const lineProblems = codeProblemsOf(problems);
  const ExpandIcon = expanded ? MinimizeIcon : MaximizeIcon;

  useEffect(() => {
    const editor = view.current;

    if (editor === null) return;

    takeOwnersText(editor, value);
  }, [value]);

  useEffect(() => {
    const editor = view.current;

    if (editor === null) return;

    const marks = lintDiagnosticsOf(problems, editor.state.doc);
    const marking = setDiagnostics(editor.state, marks);
    editor.dispatch(marking);
  }, [problems]);

  function keep(created: EditorView): void {
    view.current = created;
  }

  function report(update: ViewUpdate): void {
    const changedHere = isChangedHere(update);

    if (!changedHere) return;

    const code = update.state.doc.toString();
    onChange(code);
  }

  async function format(): Promise<void> {
    const editor = view.current;

    if (editor === null) return;
    if (running) return;

    const text = editor.state.doc.toString();
    const cursor = editor.state.selection.main.head;
    setFormatting(RUNNING);
    const answer = await formatScript(settings.library, text, cursor);

    const current = editor.state.doc.toString();
    const unchanged = current === text;
    const outcome = unchanged ? answer : OUTDATED;
    applyFormatting(editor, outcome, text);
    const words = formatWordsOf(outcome, settings.formatter);
    setFormatting({ kind: "told", words });
  }

  function startFormatting(): void {
    void format();
  }

  function formatOnShortcut(event: KeyboardEvent<HTMLDivElement>): void {
    const chord =
      event.shiftKey && event.altKey && !event.ctrlKey && !event.metaKey;
    const shortcut = chord && event.code === "KeyF";

    if (!shortcut) return;

    event.preventDefault();
    startFormatting();
  }

  function toggleExpanded(): void {
    const next = !expanded;
    onExpandedChange(next);
  }

  return (
    <div
      onKeyDown={formatOnShortcut}
      className="flex flex-col overflow-hidden rounded-md border border-control bg-(--code-bg)"
    >
      <div className="flex items-center gap-1.5 border-b bg-subtle py-1 pr-1 pl-2.5 text-caption text-muted-foreground">
        <span className="flex-1">{settings.title}</span>
        <FormatButton running={running} onFormat={startFormatting} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={expanded}
          onClick={toggleExpanded}
        >
          <ExpandIcon aria-hidden />
          Expand
        </Button>
      </div>
      <CodeMirrorView
        doc={value}
        extensions={settings.extensions}
        label={label}
        className={height}
        onView={keep}
        onUpdate={report}
      />
      <CodeStatusLine
        problems={lineProblems}
        note={settings.formatter}
        message={told}
      />
    </div>
  );
}

function FormatButton({ running, onFormat }: FormatButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-busy={running}
          aria-keyshortcuts="Shift+Alt+F"
          onClick={onFormat}
        >
          {running ? (
            <span
              aria-hidden
              className="animate-in fade-in fill-mode-backwards delay-1000"
            >
              <Loader2Icon className="animate-spin" />
            </span>
          ) : (
            <WandSparklesIcon aria-hidden />
          )}
          Format
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Format <Kbd>⇧⌥F</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

function applyFormatting(
  editor: EditorView,
  outcome: FormatOutcome,
  text: string,
): void {
  if (outcome.kind !== "formatted") return;
  if (outcome.text === text) return;

  const ownStep = isolateHistory.of("full");
  editor.dispatch({
    changes: { from: 0, to: text.length, insert: outcome.text },
    annotations: ownStep,
  });
}
