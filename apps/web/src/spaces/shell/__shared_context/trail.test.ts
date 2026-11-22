import { describe, expect, it } from "vitest";
import type { Crumb } from "@/libs/ui/composites/crumbs";
import { trailOf } from "./trail";

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
    ["/connections/webhooks", [{ label: "Webhooks" }]],
    [
      "/connections/test-event",
      [
        { label: "Webhooks", href: "/connections/webhooks" },
        { label: "Send a test event" },
      ],
    ],
    ["/connections/notifications", [{ label: "Notifications" }]],
    [
      "/connections/notifications/new",
      [
        { label: "Notifications", href: "/connections/notifications" },
        { label: "New notification" },
      ],
    ],
    [
      "/connections/notifications/ae769898",
      [
        { label: "Notifications", href: "/connections/notifications" },
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
      "/settings/invitations",
      [{ label: "Settings", href: "/settings" }, { label: "Invitations" }],
    ],
    [
      "/settings/platform",
      [{ label: "Settings", href: "/settings" }, { label: "Platform" }],
    ],
    ["/settings/unknown", [{ label: "Settings" }]],
    ["/connections", []],
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
