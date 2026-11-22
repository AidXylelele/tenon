import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteTabs } from "./route-tabs";

const pathname = vi.fn(() => "/connections/notifications/42");

vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const TABS = [
  { href: "/connections/webhooks", label: "Webhooks" },
  { href: "/connections/notifications", label: "Notifications" },
];

describe("the tabs of a page made of several", () => {
  it("marks_the_tab_whose_address_holds_the_page", () => {
    render(<RouteTabs tabs={TABS} label="Connections" />);
    const navigation = screen.getByRole("navigation", { name: "Connections" });
    const webhooks = screen.getByRole("link", { name: "Webhooks" });
    const notifications = screen.getByRole("link", { name: "Notifications" });

    expect(navigation).toContainElement(webhooks);
    expect(notifications).toHaveAttribute("aria-current", "page");
    expect(webhooks).not.toHaveAttribute("aria-current");
  });

  it("a_tab_whose_address_only_starts_the_same_is_not_current", () => {
    pathname.mockReturnValueOnce("/connections/webhooks-old");
    render(<RouteTabs tabs={TABS} label="Connections" />);
    const webhooks = screen.getByRole("link", { name: "Webhooks" });

    expect(webhooks).not.toHaveAttribute("aria-current");
  });

  it("a_tab_told_it_is_current_is_current_whatever_the_address_says", () => {
    const byQuery = [
      { href: "/workflows", label: "Active", current: false },
      { href: "/workflows?status=archived", label: "Archived", current: true },
    ];
    render(<RouteTabs tabs={byQuery} label="Workflow status" />);
    const archived = screen.getByRole("link", { name: "Archived" });
    const active = screen.getByRole("link", { name: "Active" });

    expect(archived).toHaveAttribute("aria-current", "page");
    expect(active).not.toHaveAttribute("aria-current");
  });
});
