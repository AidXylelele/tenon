import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlatformPage } from "./platform-page";
import { PROFILE } from "./profile.test-support";

describe("the platform page", () => {
  it("says_what_steps_can_do_in_sentences_and_the_limits", () => {
    render(<PlatformPage profile={PROFILE} />);

    expect(
      screen.getByText("Scripts are written in these languages."),
    ).toBeVisible();
    expect(screen.getByText("js · python")).toHaveClass("font-mono");
    expect(screen.queryByText("Calls get OAuth2 tokens.")).toBeNull();
    expect(screen.getByText(/at most 5\.0/)).toBeVisible();
  });

  it("keeps_the_shell_commands_one_click_deeper", () => {
    render(<PlatformPage profile={PROFILE} />);

    expect(screen.queryByText("jq")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /Show the shell's commands/ }),
    );
    expect(screen.getByText("jq")).toBeVisible();
  });
});
