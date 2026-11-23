import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotFoundPanel } from "./not-found-panel";

const address = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => address.pathname }));

describe("the page for an address with nothing at it", () => {
  it.each([
    ["/runs/not-a-uuid", "Go to Runs", "/runs"],
    ["/workflows/sales/gone/versions/9.9.9", "Go to Workflows", "/workflows"],
    ["/nowhere", "Go to Home", "/"],
  ])("%s_offers_a_way_to_its_place", (pathname, name, href) => {
    address.pathname = pathname;

    render(<NotFoundPanel />);

    const way = screen.getByRole("link", { name });
    expect(way).toHaveAttribute("href", href);
  });

  it.each([
    ["/runs/not-a-uuid", "No run with this address", "not-a-uuid"],
    ["/workflows/sales/gone", "No workflow with this address", "sales/gone"],
    [
      "/workflows/sales/route-lead/versions/9.9.9",
      "No version with this address",
      "9.9.9",
    ],
    [
      "/connections/notifications/4f2a",
      "No notification with this address",
      "4f2a",
    ],
  ])("%s_names_what_is_missing_and_its_id", (pathname, said, id) => {
    address.pathname = pathname;

    render(<NotFoundPanel />);

    const heading = screen.getByRole("heading", { level: 1 });
    const shown = screen.getByText(id);
    expect(heading).toHaveTextContent(said);
    expect(shown).toHaveClass("font-mono");
  });

  it("an_address_of_no_known_thing_says_nothing_is_there", () => {
    address.pathname = "/nowhere";

    render(<NotFoundPanel />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Nothing at this address");
  });
});
