import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./command";

function Palette() {
  return (
    <Command>
      <CommandInput placeholder="Search" />
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
