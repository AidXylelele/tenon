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

  it("says_what_happened_in_the_heading", () => {
    address.pathname = "/runs/not-a-uuid";

    render(<NotFoundPanel />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Nothing at this address");
  });
});
