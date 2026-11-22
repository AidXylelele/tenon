import { SecretRefusal } from "../../../../src/domain/automation/secrets/enums.js";
import { SecretValue } from "../../../../src/domain/automation/secrets/secret-value.js";

describe("SecretValue", () => {
  it("a_text_of_four_characters_is_held_as_written", () => {
    const made = SecretValue.of("abcd");

    expect(made.ok && made.value.held).toBe("abcd");
    expect(made.ok && made.value.texts).toEqual(["abcd"]);
  });

  it("a_text_shorter_than_four_characters_is_refused", () => {
    const made = SecretValue.of("abc");

    expect(made).toEqual({ ok: false, failure: SecretRefusal.TooShort });
  });

  it("an_object_is_held_parsed_and_every_text_in_it_is_one_of_its_texts", () => {
    const text = JSON.stringify({
      username: "ada-lovelace",
      keys: ["long-enough", { pin: "w0rd" }],
    });

    const made = SecretValue.of(text);

    expect(made.ok && made.value.held).toEqual({
      username: "ada-lovelace",
      keys: ["long-enough", { pin: "w0rd" }],
    });
    expect(made.ok && made.value.texts).toEqual([
      "ada-lovelace",
      "long-enough",
      "w0rd",
    ]);
  });

  it("an_object_holding_a_short_text_anywhere_is_refused", () => {
    const text = JSON.stringify({
      username: "ada-lovelace",
      keys: ["long-enough", "ab"],
    });

    const made = SecretValue.of(text);

    expect(made).toEqual({ ok: false, failure: SecretRefusal.TooShort });
  });

  it("numbers_and_booleans_an_object_holds_are_not_secret_texts_and_are_not_masked", () => {
    const text = JSON.stringify({ token: "tok-1234", port: 8, tls: true });

    const made = SecretValue.of(text);

    expect(made.ok && made.value.texts).toEqual(["tok-1234"]);
  });

  it("a_text_that_is_json_but_not_an_object_is_held_as_written", () => {
    const made = SecretValue.of('"ab"');

    expect(made.ok && made.value.held).toBe('"ab"');
    expect(made.ok && made.value.texts).toEqual(['"ab"']);
  });

  it("a_text_that_is_a_json_array_is_held_as_written", () => {
    const made = SecretValue.of('["abcd","efgh"]');

    expect(made.ok && made.value.held).toBe('["abcd","efgh"]');
    expect(made.ok && made.value.texts).toEqual(['["abcd","efgh"]']);
  });

  it("a_stored_text_is_trusted_and_keeps_its_text", () => {
    const value = new SecretValue("abc");

    expect(value.text).toBe("abc");
    expect(value.texts).toEqual(["abc"]);
  });
});
