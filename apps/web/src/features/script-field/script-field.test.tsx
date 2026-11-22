import { undo } from "@codemirror/commands";
import { diagnosticCount } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import {
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver-protocol";
import type {
  FormattingAnswer,
  FormattingRequest,
} from "@/libs/code-formatting/interfaces";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import type { ScriptFieldProps } from "./interfaces";
import { ScriptField } from "./script-field";

type Shown = Omit<ScriptFieldProps, "onChange" | "onExpandedChange">;

interface Owner {
  readonly onChange: Mock<(code: string) => void>;
  readonly onExpandedChange: Mock<(expanded: boolean) => void>;
  readonly show: (shown: Shown) => void;
}

const JS_RAW =
  "const result = people.map((person) => ({ ...person, name: person.name.trim() }));";

const JS_FORMATTED =
  "const result = people.map((person) => ({\n  ...person,\n  name: person.name.trim(),\n}));\n";

const PY_UNCLOSED =
  'import json\nscore = 10 if lead.get("email") else 0\nprint(json.dumps({"score": score})';

const UNCLOSED: Diagnostic = {
  range: { start: { line: 2, character: 5 }, end: { line: 2, character: 6 } },
  severity: DiagnosticSeverity.Error,
  message: "“(” was never closed",
};

const JAVASCRIPT: Shown = {
  language: "js",
  label: "Code",
  value: JS_RAW,
  problems: [],
  expanded: false,
};

const PYTHON: Shown = {
  language: "python",
  label: "Code",
  value: PY_UNCLOSED,
  problems: [UNCLOSED],
  expanded: false,
};

const requests: FormattingRequest[] = [];
const answers: FormattingAnswer[] = [];
const held: MessagePort[] = [];

function scriptedWorker(): EventTarget {
  const worker = new EventTarget();

  function postMessage(
    request: FormattingRequest,
    ports: readonly MessagePort[],
  ): void {
    requests.push(request);
    const [port] = ports;
    const answer = answers.shift();

    if (port === undefined) return;
    if (answer === undefined) {
      held.push(port);
      return;
    }

    port.postMessage(answer);
  }

  const terminate = vi.fn();
  return Object.assign(worker, { postMessage, terminate });
}

function showField(shown: Shown): Owner {
  const onChange = vi.fn<(code: string) => void>();
  const onExpandedChange = vi.fn<(expanded: boolean) => void>();

  function fieldOf(next: Shown) {
    return (
      <ScriptField
        language={next.language}
        label={next.label}
        value={next.value}
        problems={next.problems}
        expanded={next.expanded}
        onChange={onChange}
        onExpandedChange={onExpandedChange}
      />
    );
  }

  const first = fieldOf(shown);
  const { rerender } = render(first, { wrapper: TooltipProvider });

  function show(next: Shown): void {
    const field = fieldOf(next);
    rerender(field);
  }

  return { onChange, onExpandedChange, show };
}

function code(): HTMLElement {
  return screen.getByRole("textbox", { name: "Code" });
}

function editor(): EditorView {
  const content = code();
  const view = EditorView.findFromDOM(content);

  if (view === null) throw new Error("The field holds no editor.");

  return view;
}

function format(): void {
  const button = screen.getByRole("button", { name: "Format" });
  fireEvent.click(button);
}

function release(answer: FormattingAnswer): void {
  const port = held.shift();
  port?.postMessage(answer);
}

describe("the script field", () => {
  beforeEach(() => {
    requests.length = 0;
    answers.length = 0;
    held.length = 0;
    vi.stubGlobal("Worker", scriptedWorker);
  });

  afterEach(() => {
    for (const port of held) port.close();
  });

  it("the_code_is_an_editor_named_by_its_label_holding_the_value", () => {
    showField(JAVASCRIPT);

    const content = code();

    expect(content).toHaveTextContent(JS_RAW);
  });

  it.each<[Shown, string]>([
    [JAVASCRIPT, "JavaScript · ES2024"],
    [PYTHON, "Python 3.13"],
  ])("the_bar_names_the_language_and_its_version_%#", (shown, title) => {
    showField(shown);

    const named = screen.getByText(title);

    expect(named).toBeVisible();
  });

  it("typing_tells_the_owner_the_new_code", () => {
    const { onChange } = showField(JAVASCRIPT);
    const view = editor();

    act(() => {
      view.dispatch({ changes: { from: 0, insert: "// names\n" } });
    });

    const typed = `// names\n${JS_RAW}`;
    expect(onChange).toHaveBeenCalledExactlyOnceWith(typed);
  });

  it("a_new_value_from_the_owner_replaces_the_text_without_echo", () => {
    const { onChange, show } = showField(JAVASCRIPT);
    const changed: Shown = {
      language: "js",
      label: "Code",
      value: "console.log(1);",
      problems: [],
      expanded: false,
    };

    show(changed);

    const content = code();
    expect(content).toHaveTextContent("console.log(1);");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("code_without_problems_says_so", () => {
    showField(JAVASCRIPT);

    const clean = screen.getByText("No problems");

    expect(clean).toBeVisible();
  });

  it("a_problem_is_marked_in_the_code_and_named_by_its_line", () => {
    showField(PYTHON);

    const named = screen.getByText("Line 3: “(” was never closed");
    const marked = diagnosticCount(editor().state);
    expect(named).toBeVisible();
    expect(marked).toBe(1);
  });

  it("format_replaces_the_javascript_with_prettiers_and_says_so", async () => {
    const { onChange } = showField(JAVASCRIPT);
    answers.push({ kind: "formatted", text: JS_FORMATTED });

    format();

    const told = await screen.findByText("Formatted with Prettier");
    expect(told).toBeVisible();
    expect(requests).toEqual([{ language: "javascript", text: JS_RAW }]);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(JS_FORMATTED);
  });

  it("python_is_formatted_by_ruff", async () => {
    const shown: Shown = {
      language: "python",
      label: "Code",
      value: "x=1",
      problems: [],
      expanded: false,
    };
    const { onChange } = showField(shown);
    answers.push({ kind: "formatted", text: "x = 1\n" });

    format();

    const told = await screen.findByText("Formatted with Ruff");
    expect(told).toBeVisible();
    expect(requests).toEqual([{ language: "python", text: "x=1" }]);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("x = 1\n");
  });

  it("code_already_formatted_is_left_as_it_is", async () => {
    const { onChange } = showField(JAVASCRIPT);
    answers.push({ kind: "formatted", text: JS_RAW });

    format();

    const told = await screen.findByText("Formatted with Prettier");
    expect(told).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("a_refusal_names_the_line_and_the_formatters_words_and_keeps_the_code", async () => {
    const { onChange } = showField(PYTHON);
    answers.push({
      kind: "refused",
      message: "unexpected EOF while parsing",
      line: 3,
    });

    format();

    const told = await screen.findByText(
      "Fix line 3 first: unexpected EOF while parsing. Ruff formats only code that parses.",
    );
    const said = screen.getByRole("status");
    expect(told).toBeVisible();
    expect(said).toContainElement(told);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("a_formatter_that_cannot_run_says_why", async () => {
    showField(PYTHON);
    answers.push({ kind: "failed", message: "CompileError: refused" });

    format();

    const told = await screen.findByText(
      "Ruff could not run: CompileError: refused",
    );
    expect(told).toBeVisible();
  });

  it("the_format_button_is_busy_while_the_formatter_works", () => {
    showField(JAVASCRIPT);

    format();

    const button = screen.getByRole("button", { name: "Format" });
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("a_second_press_while_formatting_asks_the_formatter_nothing_more", () => {
    showField(JAVASCRIPT);
    format();

    format();

    expect(requests).toEqual([{ language: "javascript", text: JS_RAW }]);
  });

  it("code_changed_while_formatting_is_kept", async () => {
    const { onChange } = showField(JAVASCRIPT);
    format();
    const view = editor();
    act(() => {
      view.dispatch({ changes: { from: 0, insert: "// names\n" } });
    });

    release({ kind: "formatted", text: JS_FORMATTED });

    const told = await screen.findByText(
      "The code changed while Prettier formatted it; press Format again.",
    );
    const typed = `// names\n${JS_RAW}`;
    expect(told).toBeVisible();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(typed);
  });

  it("undo_takes_back_the_format_alone", async () => {
    showField(JAVASCRIPT);
    const view = editor();
    act(() => {
      view.dispatch({ changes: { from: 0, insert: "// names\n" } });
    });
    answers.push({ kind: "formatted", text: JS_FORMATTED });
    format();
    await screen.findByText("Formatted with Prettier");

    act(() => {
      undo(view);
    });

    const text = view.state.doc.toString();
    const typed = `// names\n${JS_RAW}`;
    expect(text).toBe(typed);
  });

  it("shift_alt_f_formats", async () => {
    showField(JAVASCRIPT);
    answers.push({ kind: "formatted", text: JS_FORMATTED });
    const content = code();

    fireEvent.keyDown(content, {
      key: "Ï",
      code: "KeyF",
      shiftKey: true,
      altKey: true,
    });

    const told = await screen.findByText("Formatted with Prettier");
    expect(told).toBeVisible();
  });

  it("the_format_button_names_its_shortcut", () => {
    showField(JAVASCRIPT);

    const button = screen.getByRole("button", { name: "Format" });

    expect(button).toHaveAttribute("aria-keyshortcuts", "Shift+Alt+F");
  });

  it("expand_asks_the_owner_to_expand_the_field", () => {
    const { onExpandedChange } = showField(JAVASCRIPT);
    const expand = screen.getByRole("button", { name: "Expand" });

    fireEvent.click(expand);

    expect(onExpandedChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("an_expanded_field_shows_expand_pressed_and_narrows_on_a_press", () => {
    const shown: Shown = {
      language: "js",
      label: "Code",
      value: JS_RAW,
      problems: [],
      expanded: true,
    };
    const { onExpandedChange } = showField(shown);
    const expand = screen.getByRole("button", { name: "Expand" });

    fireEvent.click(expand);

    expect(expand).toHaveAttribute("aria-pressed", "true");
    expect(onExpandedChange).toHaveBeenCalledExactlyOnceWith(false);
  });
});
