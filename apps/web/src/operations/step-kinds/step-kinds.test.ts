import { describe, expect, it } from "vitest";
import { familiesOfKinds, kindInfoOf } from "./step-kinds";

describe("the kinds of steps in plain words", () => {
  it("a_kind_is_given_its_label_and_description", () => {
    const info = kindInfoOf("listen");

    expect(info).toEqual({
      kind: "listen",
      label: "Wait for events",
      description: "Pause until the events arrive.",
    });
  });

  it("every_kind_is_listed_once_under_its_family", () => {
    const families = familiesOfKinds();

    const grouped = families.map(({ family, label, kinds }) => {
      const listed = kinds.map(({ kind }) => kind);
      return { family, label, listed };
    });
    expect(grouped).toEqual([
      { family: "call", label: "Call a service", listed: ["call", "run"] },
      { family: "data", label: "Set data", listed: ["set"] },
      {
        family: "event",
        label: "Send or wait for events",
        listed: ["emit", "listen"],
      },
      { family: "time", label: "Wait", listed: ["wait"] },
      {
        family: "flow",
        label: "Shape the flow",
        listed: ["switch", "for", "fork", "try", "do"],
      },
      { family: "error", label: "Raise an error", listed: ["raise"] },
    ]);
  });
});
