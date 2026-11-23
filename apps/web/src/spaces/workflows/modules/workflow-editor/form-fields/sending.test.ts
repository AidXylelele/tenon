import { describe, expect, it } from "vitest";
import { fieldOf } from "./forms.test-support";
import type { Json } from "./json";
import { sendAsEditsOf, sendAsOf } from "./sending";

const BODY = "/do/2/post/with/body";
const HEADERS = "/do/2/post/with/headers";
const FORM_TYPE = "application/x-www-form-urlencoded";

function fieldsOf(body: Json, headers: Json) {
  const bodyField = fieldOf({
    key: "body",
    pointer: BODY,
    written: body !== null,
    value: body,
  });
  const headersField = fieldOf({
    key: "headers",
    pointer: HEADERS,
    written: headers !== null,
    value: headers,
  });
  return { body: bodyField, headers: headersField };
}

describe("how a call sends its data", () => {
  it.each([
    ["nothing_yet_is_a_message", null, null, "message"],
    ["a_text_alone_is_a_message", { text: "Hi" }, null, "message"],
    ["any_other_json_is_json", { items: [] }, null, "json"],
    [
      "a_form_content_type_is_form_fields",
      { name: "Ada" },
      { "Content-Type": FORM_TYPE },
      "form",
    ],
  ] as const)("%s", (_, body, headers, expected) => {
    const fields = fieldsOf(body, headers);

    const sendAs = sendAsOf(fields.body, fields.headers);

    expect(sendAs).toBe(expected);
  });

  it("form_fields_add_the_content_type_and_an_object_body", () => {
    const fields = fieldsOf({ text: "Hi" }, { Accept: "application/json" });

    const edits = sendAsEditsOf(fields.body, fields.headers, "form");

    expect(edits).toEqual([
      {
        kind: "setField",
        pointer: HEADERS,
        value: { Accept: "application/json", "Content-Type": FORM_TYPE },
      },
    ]);
  });

  it("json_from_form_fields_drops_the_form_content_type", () => {
    const fields = fieldsOf({ name: "Ada" }, { "Content-Type": FORM_TYPE });

    const edits = sendAsEditsOf(fields.body, fields.headers, "json");

    expect(edits).toEqual([{ kind: "clearField", pointer: HEADERS }]);
  });

  it("a_message_from_json_writes_an_empty_text", () => {
    const fields = fieldsOf({ items: [] }, null);

    const edits = sendAsEditsOf(fields.body, fields.headers, "message");

    expect(edits).toEqual([
      { kind: "setField", pointer: BODY, value: { text: "" } },
    ]);
  });

  it("json_from_a_message_writes_an_empty_object", () => {
    const fields = fieldsOf({ text: "Hi" }, null);

    const edits = sendAsEditsOf(fields.body, fields.headers, "json");

    expect(edits).toEqual([{ kind: "setField", pointer: BODY, value: {} }]);
  });
});
