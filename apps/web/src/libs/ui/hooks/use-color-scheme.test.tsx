import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useColorScheme } from "./use-color-scheme";

let systemDark = false;

function Probe() {
  const scheme = useColorScheme();
  return <span>{scheme}</span>;
}

describe("the colour scheme in effect", () => {
  beforeEach(() => {
    systemDark = false;
    delete document.documentElement.dataset.theme;
    vi.stubGlobal("matchMedia", () => ({
      get matches() {
        return systemDark;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("follows_the_system_when_nothing_is_chosen", () => {
    systemDark = true;

    render(<Probe />);
    const shown = screen.getByText("dark");

    expect(shown).toBeInTheDocument();
  });

  it("a_chosen_theme_beats_the_system", () => {
    systemDark = true;
    document.documentElement.dataset.theme = "light";

    render(<Probe />);
    const shown = screen.getByText("light");

    expect(shown).toBeInTheDocument();
  });

  it("changing_the_choice_changes_the_scheme", async () => {
    render(<Probe />);

    await act(async () => {
      document.documentElement.dataset.theme = "dark";
      await Promise.resolve();
    });
    const shown = screen.getByText("dark");

    expect(shown).toBeInTheDocument();
  });
});
