import { describe, expect, it } from "vitest";
import type { Capabilities } from "@/libs/data-access/types";
import { pagesOf, placeOf, placesOf } from "./places";

const VIEWER: Capabilities = {
  author: false,
  operator: false,
  administrator: false,
};
const EDITOR: Capabilities = {
  author: true,
  operator: true,
  administrator: false,
};
const ADMINISTRATOR: Capabilities = {
  author: true,
  operator: true,
  administrator: true,
};

function labelsOf(entries: readonly { readonly label: string }[]): string[] {
  return entries.map((entry) => entry.label);
}

describe("the places of the console", () => {
  it.each([
    ["/", "Home"],
    ["/workflows/sales/route-lead/edit", "Workflows"],
    ["/runs/7c41e2d0", "Runs"],
    ["/webhooks", "Webhooks"],
    ["/notifications/new", "Notifications"],
    ["/secrets", "Secrets"],
    ["/settings/platform", "Settings"],
  ])("%s_is_under_%s", (pathname, label) => {
    const place = placeOf(pathname);

    expect(place?.label).toBe(label);
  });

  it.each(["/nowhere", "/runsheet", "/webhooks-old"])(
    "%s_is_under_no_place",
    (pathname) => {
      const place = placeOf(pathname);

      expect(place).toBeNull();
    },
  );

  it("an_editor_works_with_three_places_and_connects_with_three", () => {
    const work = placesOf(EDITOR, "work");
    const connect = placesOf(EDITOR, "connect");
    const settings = placesOf(EDITOR, "settings");
    const workLabels = labelsOf(work);
    const connectLabels = labelsOf(connect);
    const settingsLabels = labelsOf(settings);

    expect(workLabels).toEqual(["Home", "Workflows", "Runs"]);
    expect(connectLabels).toEqual(["Webhooks", "Notifications", "Secrets"]);
    expect(settingsLabels).toEqual(["Settings"]);
  });

  it("a_viewer_has_nothing_to_connect", () => {
    const connect = placesOf(VIEWER, "connect");

    expect(connect).toEqual([]);
  });

  it("no_one_signed_in_sees_only_the_places_for_everyone", () => {
    const connect = placesOf(null, "connect");
    const work = placesOf(null, "work");
    const workLabels = labelsOf(work);

    expect(connect).toEqual([]);
    expect(workLabels).toEqual(["Home", "Workflows", "Runs"]);
  });

  it.each<[string, Capabilities, string[]]>([
    [
      "viewer",
      VIEWER,
      [
        "Home",
        "Workflows",
        "Runs",
        "Settings",
        "Settings › Account",
        "Settings › Platform",
      ],
    ],
    [
      "administrator",
      ADMINISTRATOR,
      [
        "Home",
        "Workflows",
        "Runs",
        "Webhooks",
        "Notifications",
        "Secrets",
        "Settings",
        "Settings › Account",
        "Settings › People",
        "Settings › Platform",
      ],
    ],
  ])("an_%s_can_go_to_its_pages", (_, capabilities, labels) => {
    const pages = pagesOf(capabilities);
    const shown = labelsOf(pages);

    expect(shown).toEqual(labels);
  });
});
