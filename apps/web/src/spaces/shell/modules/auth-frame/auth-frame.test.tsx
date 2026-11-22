import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthFrame } from "./auth-frame";

describe("the frame of the pages outside the console", () => {
  it("shows_the_brand_above_the_page", () => {
    render(
      <AuthFrame>
        <h1>Sign in</h1>
      </AuthFrame>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveTextContent("TenonSign in");
  });
});
