import { act, fireEvent, render, screen } from "@testing-library/react";
import { SearchIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group";

function Search() {
  return (
    <InputGroup>
      <InputGroupInput aria-label="Find a workflow" />
      <InputGroupAddon>
        <SearchIcon />
        <span>Find</span>
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        <Button size="icon-xs" variant="ghost">
          Clear
        </Button>
      </InputGroupAddon>
    </InputGroup>
  );
}

describe("an input with its addons", () => {
  it("a_click_on_an_addon_puts_the_caret_in_the_input", () => {
    render(<Search />);
    const addon = screen.getByText("Find");

    act(() => {
      fireEvent.click(addon);
    });

    const input = screen.getByRole("textbox", { name: "Find a workflow" });
    expect(input).toHaveFocus();
  });

  it("a_click_on_a_button_in_an_addon_leaves_the_input_alone", () => {
    render(<Search />);
    const clear = screen.getByRole("button", { name: "Clear" });

    act(() => {
      fireEvent.click(clear);
    });

    const input = screen.getByRole("textbox", { name: "Find a workflow" });
    expect(input).not.toHaveFocus();
  });
});
