import { lintGutter } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Profiler, StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeMirrorView } from "./codemirror-view";

const TAB_SIZE_TWO = EditorState.tabSize.of(2);
const TAB_SIZE_FOUR = EditorState.tabSize.of(4);

describe("codemirror hosted in react with its state as the text", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("it_mounts_one_editor_with_its_text_and_name", () => {
    const { container } = render(
      <CodeMirrorView doc="a: 1" label="Workflow text" />,
    );

    const editors = container.querySelectorAll(".cm-editor");
    const content = screen.getByRole("textbox", { name: "Workflow text" });
    expect(editors).toHaveLength(1);
    expect(content).toHaveTextContent("a: 1");
  });

  it("strict_mode_leaves_exactly_one_view", () => {
    const destroy = vi.spyOn(EditorView.prototype, "destroy");

    const { container } = render(
      <StrictMode>
        <CodeMirrorView doc="a: 1" label="Workflow text" />
      </StrictMode>,
    );

    const editors = container.querySelectorAll(".cm-editor");
    expect(editors).toHaveLength(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("unmounting_destroys_the_view", () => {
    const { container, unmount } = render(
      <CodeMirrorView doc="a: 1" label="Workflow text" />,
    );
    const destroy = vi.spyOn(EditorView.prototype, "destroy");

    unmount();

    const editors = container.querySelectorAll(".cm-editor");
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(editors).toHaveLength(0);
  });

  it("read_only_is_reconfigured_on_the_same_view", () => {
    const onView = vi.fn<(view: EditorView) => void>();
    const { rerender } = render(
      <CodeMirrorView doc="a: 1" label="Workflow text" onView={onView} />,
    );
    const view = onView.mock.calls[0]?.[0];

    rerender(
      <CodeMirrorView
        doc="a: 1"
        label="Workflow text"
        onView={onView}
        readOnly
      />,
    );

    const readOnly = view?.state.readOnly;
    const content = screen.getByRole("textbox", { name: "Workflow text" });
    expect(onView).toHaveBeenCalledTimes(1);
    expect(readOnly).toBe(true);
    expect(content).toHaveAttribute("aria-readonly", "true");
  });

  it("new_extensions_are_reconfigured_on_the_same_view", () => {
    const onView = vi.fn<(view: EditorView) => void>();
    const { rerender } = render(
      <CodeMirrorView
        doc="a: 1"
        label="Workflow text"
        onView={onView}
        extensions={TAB_SIZE_TWO}
      />,
    );
    const view = onView.mock.calls[0]?.[0];

    rerender(
      <CodeMirrorView
        doc="a: 1"
        label="Workflow text"
        onView={onView}
        extensions={TAB_SIZE_FOUR}
      />,
    );

    const tabSize = view?.state.tabSize;
    expect(onView).toHaveBeenCalledTimes(1);
    expect(tabSize).toBe(4);
  });

  it("typing_commits_no_react_render", () => {
    const onView = vi.fn<(view: EditorView) => void>();
    const onRender = vi.fn();
    render(
      <Profiler id="editor" onRender={onRender}>
        <CodeMirrorView doc="a: 1" label="Workflow text" onView={onView} />
      </Profiler>,
    );
    const view = onView.mock.calls[0]?.[0];
    onRender.mockClear();

    act(() => {
      view?.dispatch({ changes: { from: 0, insert: "x" } });
    });

    const text = view?.state.doc.toString();
    expect(onRender).not.toHaveBeenCalled();
    expect(text).toMatch(/^x/);
  });

  it("every_update_reaches_its_owner", () => {
    const onView = vi.fn<(view: EditorView) => void>();
    const onUpdate = vi.fn<(update: ViewUpdate) => void>();
    render(
      <CodeMirrorView
        doc="a: 1"
        label="Workflow text"
        onView={onView}
        onUpdate={onUpdate}
      />,
    );
    const view = onView.mock.calls[0]?.[0];

    act(() => {
      view?.dispatch({ changes: { from: 0, insert: "x" } });
    });

    const docChanged = onUpdate.mock.lastCall?.[0].docChanged;
    expect(docChanged).toBe(true);
  });

  it("escape_then_tab_is_left_to_the_browser", () => {
    const onView = vi.fn<(view: EditorView) => void>();
    render(<CodeMirrorView doc="a: 1" label="Workflow text" onView={onView} />);
    const view = onView.mock.calls[0]?.[0];
    const content = screen.getByRole("textbox", { name: "Workflow text" });
    const tab = createEvent.keyDown(content, {
      key: "Tab",
      code: "Tab",
      keyCode: 9,
    });

    fireEvent.keyDown(content, { key: "Escape", code: "Escape", keyCode: 27 });
    fireEvent(content, tab);

    const text = view?.state.doc.toString();
    expect(tab.defaultPrevented).toBe(false);
    expect(text).toBe("a: 1");
  });

  it("the_way_out_of_the_text_is_told_to_the_person", () => {
    render(<CodeMirrorView doc="a: 1" label="Workflow text" />);
    const content = screen.getByRole("textbox", { name: "Workflow text" });

    expect(content).toHaveAccessibleDescription(
      "Tab indents. To leave the text, press Esc, then Tab.",
    );
  });

  it("read_only_text_is_still_reached_by_tab", () => {
    render(<CodeMirrorView doc="a: 1" label="Workflow text" readOnly />);

    const content = screen.getByRole("textbox", { name: "Workflow text" });

    expect(content).toHaveAttribute("tabindex", "0");
  });

  it("the_line_with_the_cursor_is_marked_in_the_gutter_with_no_fill", () => {
    const { container } = render(
      <CodeMirrorView doc={"a: 1\nb: 2"} label="Workflow text" />,
    );

    const filled = container.querySelector(".cm-activeLine");
    const marked = container.querySelector(".cm-activeLineGutter");
    expect(filled).toBeNull();
    expect(marked).toHaveTextContent("1");
  });

  it("the_gutters_run_problems_then_line_numbers_then_folds", () => {
    const markers = lintGutter();
    const { container } = render(
      <CodeMirrorView
        doc={"a:\n  b: 1"}
        label="Workflow text"
        extensions={markers}
      />,
    );

    const gutters = container.querySelectorAll(".cm-gutter");
    const order = Array.from(gutters, (gutter) => gutter.className);
    expect(order).toEqual([
      "cm-gutter cm-gutter-lint",
      "cm-gutter cm-lineNumbers",
      "cm-gutter cm-foldGutter",
    ]);
  });

  it("tab_alone_is_kept_to_indent", () => {
    const onView = vi.fn<(view: EditorView) => void>();
    render(<CodeMirrorView doc="a: 1" label="Workflow text" onView={onView} />);
    const view = onView.mock.calls[0]?.[0];
    const content = screen.getByRole("textbox", { name: "Workflow text" });
    const tab = createEvent.keyDown(content, {
      key: "Tab",
      code: "Tab",
      keyCode: 9,
    });

    fireEvent(content, tab);

    const text = view?.state.doc.toString();
    expect(tab.defaultPrevented).toBe(true);
    expect(text).toBe("  a: 1");
  });
});
