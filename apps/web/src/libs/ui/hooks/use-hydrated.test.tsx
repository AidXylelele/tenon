import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useHydrated } from "./use-hydrated";

function Probe() {
  const hydrated = useHydrated();
  return <span>{hydrated ? "in the browser" : "on the server"}</span>;
}

describe("whether the page has hydrated", () => {
  it("the_server_renders_before_hydration", () => {
    const html = renderToString(<Probe />);

    expect(html).toBe("<span>on the server</span>");
  });

  it("the_browser_renders_after_hydration", () => {
    render(<Probe />);

    const shown = screen.getByText("in the browser");
    expect(shown).toBeInTheDocument();
  });
});
