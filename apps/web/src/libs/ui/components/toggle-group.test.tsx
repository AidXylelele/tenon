import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

describe("a segmented control", () => {
  it("choosing_an_item_makes_it_the_one_chosen", () => {
    render(
      <ToggleGroup type="single" defaultValue="flow" aria-label="View">
        <ToggleGroupItem value="flow">Flow</ToggleGroupItem>
        <ToggleGroupItem value="code">Code</ToggleGroupItem>
      </ToggleGroup>,
    );
    const code = screen.getByRole("radio", { name: "Code" });

    act(() => {
      fireEvent.click(code);
    });

    const chosen = screen
      .getAllByRole("radio")
      .filter((item) => item.getAttribute("aria-checked") === "true")
      .map((item) => item.textContent);
    expect(chosen).toEqual(["Code"]);
  });
});
