import { EditorView } from "@codemirror/view";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { TemplatePart } from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { Announcer } from "@/libs/ui/composites/announcer";
import { AFTER_A_TEST, AFTER_FETCH } from "./data-choices/data.test-support";
import { DataField } from "./data-field";
import { TemplateField } from "./template-field";

const MIXED: readonly TemplatePart[] = [
  { kind: "text", text: "New digest: " },
  { kind: "data", expression: ".slideshow.title", label: "title" },
];

function field(parts: readonly TemplatePart[] = MIXED) {
  const onTemplate = vi.fn();
  render(
    <Announcer>
      <TooltipProvider>
        <span id="message-label">Message</span>
        <TemplateField
          parts={parts}
          data={AFTER_A_TEST}
          inputId="message"
          labelId="message-label"
          describedBy={undefined}
          invalid={false}
          onTemplate={onTemplate}
        />
      </TooltipProvider>
    </Announcer>,
  );
  const content = document.querySelector<HTMLElement>(".cm-content");

  if (content === null) throw new Error("The template field has no text");

  const view = EditorView.findFromDOM(content);

  if (view === null) throw new Error("The template field has no editor");

  return { onTemplate, content, view };
}

describe("a field of text with data inside it", () => {
  it("shows_the_text_and_names_the_data_in_a_chip", () => {
    const { content } = field();

    expect(content).toHaveTextContent("New digest:");
    expect(content).toHaveTextContent("Fetch the digest › slideshow › title");
    expect(content).toHaveAttribute("aria-labelledby", "message-label");
  });

  it("typed_text_is_sent_as_parts_when_the_field_is_left", () => {
    const { onTemplate, content, view } = field();

    act(() => {
      view.dispatch({ changes: { from: 0, insert: "Today: " } });
      fireEvent.blur(content);
    });

    expect(onTemplate).toHaveBeenCalledWith(
      [{ kind: "text", text: "Today: New digest: " }, MIXED[1]],
      null,
    );
  });

  it("a_field_left_unchanged_sends_nothing", () => {
    const { onTemplate, content } = field();

    act(() => {
      fireEvent.blur(content);
    });

    expect(onTemplate).not.toHaveBeenCalled();
  });

  it("a_removed_chip_leaves_only_the_text", () => {
    const { onTemplate, content, view } = field();
    const length = view.state.doc.length;

    act(() => {
      view.dispatch({ changes: { from: length - 1, to: length } });
      fireEvent.blur(content);
    });

    expect(onTemplate).toHaveBeenCalledWith(
      [{ kind: "text", text: "New digest: " }],
      null,
    );
  });

  it("data_picked_goes_in_at_the_cursor_and_is_sent_at_once", () => {
    const { onTemplate, view } = field();

    act(() => {
      view.dispatch({ selection: { anchor: 0 } });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Insert data" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("option", { name: /Greet › message/ }));
    });

    const [parts, use] = onTemplate.mock.calls[0] ?? [];
    expect(parts).toEqual([
      {
        kind: "data",
        expression: "$context.Greet.message",
        label: "Greet › message",
      },
      ...MIXED,
    ]);
    expect(use).toEqual({
      value: "${ $context.Greet.message }",
      export: "/do/Greet",
    });
  });

  it("a_line_break_is_never_written_into_it", () => {
    const { view } = field();

    act(() => {
      view.dispatch({ changes: { from: 0, insert: "a\nb" } });
    });

    expect(view.state.doc.lines).toBe(1);
  });
});

describe("a data field holding text", () => {
  it("data_picked_into_typed_text_makes_it_a_template", () => {
    const onTemplate = vi.fn();
    render(
      <Announcer>
        <TooltipProvider>
          <span id="body-label">Message</span>
          <DataField
            pointer="/do/2/post/with/body/text"
            value="Hello "
            inputId="body"
            labelId="body-label"
            describedBy={undefined}
            invalid={false}
            placeholder=""
            data={AFTER_FETCH}
            onText={vi.fn()}
            onUse={vi.fn()}
            onTemplate={onTemplate}
            onClear={vi.fn()}
          />
        </TooltipProvider>
      </Announcer>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Insert data" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("option", { name: /Greet › message/ }));
    });

    const [parts] = onTemplate.mock.calls[0] ?? [];
    expect(parts).toEqual([
      { kind: "text", text: "Hello " },
      {
        kind: "data",
        expression: "$context.Greet.message",
        label: "Greet › message",
      },
    ]);
  });
});
