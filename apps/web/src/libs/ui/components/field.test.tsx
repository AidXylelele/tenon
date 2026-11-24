import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldError } from "./field";

describe("the errors under a field", () => {
  it("one_error_is_said_in_its_own_words", () => {
    render(<FieldError errors={[{ message: "Enter the address" }]} />);

    const said = screen.getByRole("alert");
    expect(said).toHaveTextContent("Enter the address");
  });

  it("the_same_error_twice_is_said_once", () => {
    render(
      <FieldError
        errors={[
          { message: "Enter the address" },
          { message: "Enter the address" },
        ]}
      />,
    );

    const said = screen.getByRole("alert");
    expect(said).toHaveTextContent(/^Enter the address$/);
  });

  it("several_errors_are_listed", () => {
    render(
      <FieldError
        errors={[{ message: "Enter the address" }, { message: "Use https" }]}
      />,
    );

    const items = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items).toEqual(["Enter the address", "Use https"]);
  });

  it("no_error_says_nothing", () => {
    render(<FieldError errors={[]} />);

    const said = screen.queryByRole("alert");
    expect(said).not.toBeInTheDocument();
  });
});
