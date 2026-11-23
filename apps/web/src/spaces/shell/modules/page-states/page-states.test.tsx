import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LostPage } from "./lost-page";
import { PageError } from "./page-error";
import { PageNotFound } from "./page-not-found";

vi.mock("next/navigation", () => ({ usePathname: () => "/runs/not-a-uuid" }));

class Digested extends Error {
  readonly digest = "4211";
}

describe("the states a console page can be in", () => {
  it.each([
    ["inside", PageNotFound],
    ["outside", LostPage],
  ])(
    "an_address_with_nothing_%s_the_console_says_what_is_missing",
    (_, Missing) => {
      render(<Missing />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent("No run with this address");
    },
  );

  it("a_page_that_failed_gives_its_reference_and_tries_again", () => {
    const retry = vi.fn<() => void>();
    const failed = new Digested("boom");
    render(<PageError error={failed} retry={retry} />);

    const again = screen.getByRole("button", { name: "Try again" });
    fireEvent.click(again);

    const reference = screen.getByText("Reference 4211");
    expect(reference).toBeInTheDocument();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("a_page_that_failed_without_a_reference_gives_none", () => {
    const retry = vi.fn<() => void>();

    render(<PageError error="boom" retry={retry} />);

    const reference = screen.queryByText(/^Reference/);
    expect(reference).not.toBeInTheDocument();
  });
});
