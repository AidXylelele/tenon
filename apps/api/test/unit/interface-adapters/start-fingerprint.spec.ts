import { StartFingerprint } from "../../../src/interface-adapters/api/schemas/instance.schema.js";

describe("the fingerprint of a start request", () => {
  it("an_omitted_input_and_version_are_fingerprinted_as_their_defaults", () => {
    const omitted = StartFingerprint.parse({});
    const spelled = StartFingerprint.parse({ input: {}, version: "latest" });

    expect(omitted).toEqual({ input: {}, version: "latest" });
    expect(spelled).toEqual(omitted);
  });

  it.each([{ input: 1, extra: true }, { version: "" }, "not an object", null])(
    "a_body_the_route_refuses_is_fingerprinted_as_sent (%j)",
    (body) => {
      const fingerprint = StartFingerprint.parse(body);

      expect(fingerprint).toEqual(body);
    },
  );
});
