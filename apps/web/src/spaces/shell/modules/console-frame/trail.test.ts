import { describe, expect, it } from "vitest";
import { type Crumb, trailOf } from "./trail";

describe("the breadcrumb an address shows", () => {
  it.each<[string, Crumb[]]>([
    ["/", [{ label: "Home" }]],
    ["/workflows", [{ label: "Workflows" }]],
    [
      "/workflows/new",
      [{ label: "Workflows", href: "/workflows" }, { label: "New workflow" }],
    ],
    [
      "/workflows/sales/route-lead",
      [{ label: "Workflows", href: "/workflows" }, { label: "route-lead" }],
    ],
    [
      "/workflows/sales/route-lead/edit",
      [
        { label: "Workflows", href: "/workflows" },
        { label: "route-lead", href: "/workflows/sales/route-lead" },
        { label: "Editor" },
      ],
    ],
    [
      "/workflows/sales/route-lead/versions/1.2.0",
      [
        { label: "Workflows", href: "/workflows" },
        { label: "route-lead", href: "/workflows/sales/route-lead" },
        { label: "Version 1.2.0" },
      ],
    ],
    [
      "/workflows/sales/route-lead/elsewhere",
      [
        { label: "Workflows", href: "/workflows" },
        { label: "route-lead", href: "/workflows/sales/route-lead" },
      ],
    ],
    ["/workflows/sales", [{ label: "Workflows" }]],
    ["/runs", [{ label: "Runs" }]],
    [
      "/runs/7c41e2d0-5b0e-4a13-9f2b-cf9b8fad0001",
      [{ label: "Runs", href: "/runs" }, { label: "Run 7c41e2d0" }],
    ],
    ["/webhooks", [{ label: "Webhooks" }]],
    ["/notifications", [{ label: "Notifications" }]],
    [
      "/notifications/new",
      [
        { label: "Notifications", href: "/notifications" },
        { label: "New notification" },
      ],
    ],
    [
      "/notifications/ae769898",
      [
        { label: "Notifications", href: "/notifications" },
        { label: "Notification" },
      ],
    ],
    ["/secrets", [{ label: "Secrets" }]],
    ["/settings", [{ label: "Settings" }]],
    [
      "/settings/account",
      [{ label: "Settings", href: "/settings" }, { label: "Account" }],
    ],
    [
      "/settings/people",
      [{ label: "Settings", href: "/settings" }, { label: "People" }],
    ],
    [
      "/settings/platform",
      [{ label: "Settings", href: "/settings" }, { label: "Platform" }],
    ],
    ["/settings/unknown", [{ label: "Settings" }]],
    ["/connections", []],
    ["/settings/invitations", [{ label: "Settings" }]],
    ["/nowhere", []],
  ])("%s_shows_its_trail", (pathname, trail) => {
    const shown = trailOf(pathname);

    expect(shown).toEqual(trail);
  });

  it("an_encoded_name_is_shown_decoded_and_linked_encoded", () => {
    const shown = trailOf("/workflows/sales/route%20lead/edit");

    expect(shown[1]).toEqual({
      label: "route lead",
      href: "/workflows/sales/route%20lead",
    });
  });

  it("a_name_that_does_not_decode_is_shown_as_written", () => {
    const shown = trailOf("/workflows/sales/route%E0");

    expect(shown[1]).toEqual({ label: "route%E0" });
  });
});
