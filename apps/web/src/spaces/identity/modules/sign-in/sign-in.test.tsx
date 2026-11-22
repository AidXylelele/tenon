import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignIn } from "./sign-in";

vi.mock("./actions", () => ({ signInAction: vi.fn() }));

describe("the sign-in page", () => {
  it("a_known_reason_shows_its_notice", () => {
    render(<SignIn query={{ reason: "ended" }} />);

    const notice = screen.getByRole("alert");
    expect(notice).toHaveTextContent("Your session ended");
  });

  it.each([
    "nonsense",
    "__proto__",
    "constructor",
    "toString",
    "hasOwnProperty",
  ])("a_reason_it_does_not_know_shows_no_notice_for_%j", (reason) => {
    render(<SignIn query={{ reason }} />);

    const notice = screen.queryByRole("alert");
    expect(notice).toBeNull();
  });
});
