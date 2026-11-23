import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RunPager } from "./run-pager";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({
    prefetch,
    href,
    children,
    ...props
  }: React.ComponentProps<"a"> & { readonly prefetch: boolean | null }) => (
    <a href={href} data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}));

function hrefOf(page: number, size: number): string {
  return `/runs?page=${String(page)}&size=${String(size)}`;
}

describe("the pages of a run table", () => {
  it("says_the_range_shown_and_numbers_the_pages_marking_this_one", () => {
    render(<RunPager page={2} size={50} total={157} exact hrefOf={hrefOf} />);
    const pages = screen.getByRole("navigation", { name: "Pages" });
    const current = screen.getByRole("link", { name: "Page 2" });
    const next = screen.getByRole("link", { name: "Next page" });

    expect(screen.getByText("51–100 of 157")).toBeInTheDocument();
    expect(pages).toHaveTextContent("1234");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(next).toHaveAttribute("href", "/runs?page=3&size=50");
  });

  it("the_first_page_has_no_previous_page_and_the_last_no_next", () => {
    render(<RunPager page={1} size={50} total={20} exact hrefOf={hrefOf} />);
    const previous = screen.getByRole("link", { name: "Previous page" });
    const next = screen.getByRole("link", { name: "Next page" });

    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(next).toHaveAttribute("aria-disabled", "true");
  });

  it("a_total_past_the_counted_runs_reads_more_than", () => {
    render(
      <RunPager
        page={1}
        size={50}
        total={10_000}
        exact={false}
        hrefOf={hrefOf}
      />,
    );

    expect(screen.getByText("1–50 of more than 10,000")).toBeInTheDocument();
  });

  it("another_page_size_goes_to_its_first_page", () => {
    render(<RunPager page={3} size={50} total={400} exact hrefOf={hrefOf} />);
    const sizes = screen.getByRole("combobox", { name: "Rows per page" });

    fireEvent.keyDown(sizes, { key: "Enter" });
    const hundred = screen.getByRole("option", { name: "100" });
    fireEvent.keyDown(hundred, { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/runs?page=1&size=100");
  });
});
