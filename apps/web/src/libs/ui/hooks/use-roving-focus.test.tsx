import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useRovingFocus } from "./use-roving-focus";

interface ToolsProps {
  readonly names: readonly string[];
  readonly preferred: string | null;
  readonly asked?: readonly string[];
}

function Tools({ names, preferred, asked = [] }: ToolsProps) {
  const container = useRef<HTMLDivElement>(null);
  const { itemProps, onFocus, onKeyDown, focus } = useRovingFocus(
    container,
    preferred,
    names,
  );

  return (
    <div ref={container} onFocus={onFocus} onKeyDown={onKeyDown}>
      {names.map((name) => (
        <button key={name} type="button" {...itemProps(name)}>
          {name}
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          focus(asked);
        }}
      >
        Outside
      </button>
    </div>
  );
}

const NAMES = ["Cut", "Copy", "Paste"];

function button(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

describe("a roving focus", () => {
  it("makes_the_preferred_item_the_one_tab_stop", () => {
    render(<Tools names={NAMES} preferred="Copy" />);

    const copy = button("Copy");
    const outside = button("Outside");
    const stops = screen
      .getAllByRole("button")
      .filter((each) => each.tabIndex === 0);

    expect(stops).toEqual([copy, outside]);
  });

  it("makes_the_first_item_the_stop_when_none_is_preferred", () => {
    render(<Tools names={NAMES} preferred={null} />);

    const cut = button("Cut");

    expect(cut).toHaveAttribute("tabindex", "0");
  });

  it("makes_the_first_item_the_stop_when_the_preferred_one_is_gone", () => {
    render(<Tools names={NAMES} preferred="Delete" />);

    const cut = button("Cut");

    expect(cut).toHaveAttribute("tabindex", "0");
  });

  it("makes_the_item_focused_last_the_stop", () => {
    render(<Tools names={NAMES} preferred="Cut" />);
    const paste = button("Paste");

    fireEvent.focus(paste);

    const cut = button("Cut");
    expect(paste).toHaveAttribute("tabindex", "0");
    expect(cut).toHaveAttribute("tabindex", "-1");
  });

  it.each([
    ["ArrowDown", "Copy", "Paste"],
    ["ArrowRight", "Copy", "Paste"],
    ["ArrowUp", "Copy", "Cut"],
    ["ArrowLeft", "Copy", "Cut"],
    ["Home", "Paste", "Cut"],
    ["End", "Cut", "Paste"],
    ["ArrowDown", "Paste", "Paste"],
    ["ArrowUp", "Cut", "Cut"],
  ])("%s_from_%s_moves_to_%s", (key, from, to) => {
    render(<Tools names={NAMES} preferred={from} />);
    const start = button(from);
    start.focus();

    fireEvent.keyDown(start, { key });

    const reached = button(to);
    expect(reached).toHaveFocus();
  });

  it("leaves_other_keys_to_the_item", () => {
    render(<Tools names={NAMES} preferred="Copy" />);
    const copy = button("Copy");
    copy.focus();

    const handled = !fireEvent.keyDown(copy, { key: "Enter" });

    expect(handled).toBe(false);
    expect(copy).toHaveFocus();
  });

  it("leaves_a_key_another_handler_took", () => {
    render(<Tools names={NAMES} preferred="Copy" />);
    const copy = button("Copy");
    copy.focus();
    copy.addEventListener("keydown", (event) => {
      event.preventDefault();
    });

    fireEvent.keyDown(copy, { key: "ArrowDown" });

    expect(copy).toHaveFocus();
  });

  it("moves_the_stop_to_the_first_item_when_its_item_goes", () => {
    const shown = render(<Tools names={NAMES} preferred="Paste" />);

    const fewer = <Tools names={["Cut", "Copy"]} preferred="Paste" />;

    shown.rerender(fewer);

    const cut = button("Cut");
    expect(cut).toHaveAttribute("tabindex", "0");
  });

  it("focuses_the_first_of_the_asked_items_that_is_there", () => {
    render(<Tools names={NAMES} preferred="Cut" asked={["Delete", "Paste"]} />);

    const outside = button("Outside");

    fireEvent.click(outside);

    const paste = button("Paste");
    expect(paste).toHaveFocus();
  });
});
