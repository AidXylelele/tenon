import { describe, expect, it } from "vitest";
import { z } from "zod";
import { field, IDLE, refusalOf } from "./form-state";

describe("a submitted form", () => {
  it("reads_a_field_as_its_text", () => {
    const form = new FormData();
    form.set("email", " ada@example.com ");

    expect(field(form, "email")).toBe(" ada@example.com ");
  });

  it("a_missing_field_reads_as_empty", () => {
    expect(field(new FormData(), "email")).toBe("");
  });

  it("a_file_reads_as_empty", () => {
    const form = new FormData();
    const file = new File(["secret"], "value.txt");
    form.set("value", file);

    expect(field(form, "value")).toBe("");
  });

  it("a_refused_field_is_named_by_its_pointer_with_the_reason", () => {
    const schema = z.object({
      role: z.enum(["admin", "editor"], "Choose a role"),
    });
    const parsed = schema.safeParse({ role: "owner" });
    const error = parsed.success ? null : parsed.error;

    const state = error === null ? IDLE : refusalOf(error);

    expect(state.done).toBe(false);
    expect(state.problem?.errors).toEqual([
      { pointer: "/role", detail: "Choose a role", line: null, column: null },
    ]);
  });
});
