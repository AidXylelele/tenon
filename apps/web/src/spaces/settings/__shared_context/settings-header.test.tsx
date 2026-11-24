import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsHeader } from "./settings-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/platform",
}));

describe("the settings header", () => {
  it("names_the_page_and_marks_the_tab_on_show", () => {
    render(<SettingsHeader administrator={false} />);

    const heading = screen.getByRole("heading", { level: 1 });
    const platform = screen.getByRole("link", { name: "Platform" });
    const people = screen.queryByRole("link", { name: "People" });

    expect(heading).toHaveTextContent("Settings");
    expect(platform).toHaveAttribute("aria-current", "page");
    expect(people).toBeNull();
  });

  it("offers_people_to_an_administrator", () => {
    render(<SettingsHeader administrator />);

    const people = screen.getByRole("link", { name: "People" });

    expect(people).toBeVisible();
  });
});
