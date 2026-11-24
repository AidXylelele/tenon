import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  useCommandState,
} from "./command";

function Matches() {
  const count = useCommandState((state) => state.filtered.count);

  return <p>{count} matching</p>;
}

function Palette() {
  return (
    <Command>
      <CommandInput placeholder="Search" />
      <Matches />
      <CommandList>
        <CommandGroup heading="Actions">
          <CommandItem>New workflow</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pages">
          <CommandItem>Runs</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

describe("the line between groups of commands", () => {
  it("it_goes_while_a_search_narrows_the_list", () => {
    const { container, getByPlaceholderText } = render(<Palette />);
    const search = getByPlaceholderText("Search");

    act(() => {
      fireEvent.change(search, { target: { value: "run" } });
    });

    const line = container.querySelector('[data-slot="command-separator"]');
    expect(line).toBeNull();
  });
});

describe("the count of matching commands", () => {
  it("a_search_tells_how_many_commands_still_match", () => {
    render(<Palette />);
    const search = screen.getByPlaceholderText("Search");

    act(() => {
      fireEvent.change(search, { target: { value: "run" } });
    });

    const count = screen.getByText("1 matching");
    expect(count).toBeInTheDocument();
  });
});

describe("the option the search field points at", () => {
  it("on_open_it_names_the_highlighted_option", () => {
    render(<Palette />);

    const search = screen.getByRole("combobox");
    const highlighted = screen.getByRole("option", { selected: true });
    expect(search).toHaveAttribute("aria-activedescendant", highlighted.id);
  });

  it("after_typing_it_names_the_option_highlighted_now", () => {
    render(<Palette />);
    const search = screen.getByRole("combobox");

    act(() => {
      fireEvent.change(search, { target: { value: "run" } });
    });

    const highlighted = screen.getByRole("option", { selected: true });
    expect(highlighted).toHaveTextContent("Runs");
    expect(search).toHaveAttribute("aria-activedescendant", highlighted.id);
  });
});
