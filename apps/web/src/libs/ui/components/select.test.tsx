import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

function Method({ open }: { readonly open: boolean }) {
  return (
    <Select defaultValue="get" defaultOpen={open}>
      <SelectTrigger aria-label="Method">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="get">GET</SelectItem>
        <SelectItem value="post">POST</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("a select of fixed options", () => {
  it("a_closed_select_is_reached_with_tab", () => {
    render(<Method open={false} />);

    const trigger = screen.getByRole("combobox", { name: "Method" });
    expect(trigger).not.toHaveAttribute("tabindex", "-1");
  });

  it("an_open_select_takes_its_trigger_out_of_the_tab_order", () => {
    render(<Method open />);

    const trigger = screen.getByRole("combobox", {
      name: "Method",
      hidden: true,
    });
    expect(trigger).toHaveAttribute("tabindex", "-1");
  });
});
