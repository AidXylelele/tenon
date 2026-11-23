import { describe, expect, it } from "vitest";
import { zoneOf } from "./viewer-zone";

describe("the viewer's time zone", () => {
  it.each([
    ["Europe/Kyiv", "Europe/Kyiv"],
    [undefined, "UTC"],
    ["", "UTC"],
    ["Mars/Olympus", "UTC"],
  ])("%s_is_read_as_%s", (text, zone) => {
    const read = zoneOf(text);

    expect(read).toBe(zone);
  });
});
