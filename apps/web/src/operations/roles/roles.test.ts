import { describe, expect, it } from "vitest";
import type { Role } from "@/libs/data-access/types";
import { roleDuties, roleLabel, roleNoun } from "./roles";

describe("the words for a person's role", () => {
  it.each<[Role, string, string, string]>([
    [
      "admin",
      "Administrator",
      "an administrator",
      "everything editors do, and inviting people",
    ],
    ["editor", "Editor", "an editor", "builds, runs and connects automations"],
    ["viewer", "Viewer", "a viewer", "reads workflows and runs"],
  ])(
    "an_%s_is_named_and_described_in_plain_words",
    (role, expectedLabel, expectedNoun, expectedDuties) => {
      const label = roleLabel(role);
      const noun = roleNoun(role);
      const duties = roleDuties(role);

      expect({ label, noun, duties }).toEqual({
        label: expectedLabel,
        noun: expectedNoun,
        duties: expectedDuties,
      });
    },
  );
});
