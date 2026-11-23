import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrailName, TrailNames, useTrailName } from "./trail-name";

function Shown() {
  const named = useTrailName();
  const words = named === null ? "unnamed" : `${named.href} ${named.label}`;

  return <p>{words}</p>;
}

function page(named: boolean) {
  return (
    <TrailNames>
      {named && <TrailName href="/workflows/sales/lead" label="Route a lead" />}
      <Shown />
    </TrailNames>
  );
}

describe("a name a page gives its place in the trail", () => {
  it("is_read_while_the_page_is_shown_and_gone_after_it", () => {
    const view = render(page(true));

    const shown = screen.getByText("/workflows/sales/lead Route a lead");
    expect(shown).toBeInTheDocument();

    view.rerender(page(false));

    const unnamed = screen.getByText("unnamed");
    expect(unnamed).toBeInTheDocument();
  });

  it("outside_the_names_nothing_is_named", () => {
    render(<Shown />);

    const unnamed = screen.getByText("unnamed");
    expect(unnamed).toBeInTheDocument();
  });
});
