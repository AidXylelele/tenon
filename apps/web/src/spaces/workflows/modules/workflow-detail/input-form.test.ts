import { describe, expect, it } from "vitest";
import { inputFieldsOf } from "./input-form";

describe("the input form from a schema", () => {
  it("a_schema_that_requires_a_name_it_does_not_list_is_left_to_json", () => {
    const document = {
      type: "object",
      properties: { email: { type: "string" } },
      required: ["email", "plan"],
    };

    const fields = inputFieldsOf({ format: "json", document }, {}, new Map());

    expect(fields).toBeNull();
  });

  it("a_nested_object_with_a_combinator_is_one_json_field", () => {
    const address = {
      type: "object",
      properties: { city: { type: "string" } },
      oneOf: [{ required: ["city"] }],
    };
    const document = { type: "object", properties: { address } };

    const fields = inputFieldsOf({ format: "json", document }, {}, new Map());

    expect(fields?.map((field) => field.input)).toEqual(["structured"]);
  });
});
