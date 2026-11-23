import { describe, expect, it } from "vitest";
import { isFiltered, runsAddressOf, runsHrefOf } from "./runs-address";

describe("the Runs address", () => {
  it("an_empty_address_is_every_run_at_any_time_newest_first_fifty_a_page", () => {
    const address = runsAddressOf({});

    expect(address).toEqual({
      namespace: undefined,
      name: undefined,
      version: undefined,
      statuses: [],
      started: "all",
      page: 1,
      size: 50,
      sort: "started",
    });
    expect(isFiltered(address)).toBe(false);
  });

  it("the_filters_the_page_and_the_order_go_back_to_the_same_address", () => {
    const text =
      "/runs?namespace=sales&name=route-lead&status=in-progress%2Cfailed&started=7d&page=3&size=25&sort=duration";
    const query = Object.fromEntries(new URL(text, "http://x").searchParams);

    const address = runsAddressOf(query);
    const again = runsHrefOf(address);

    expect(again).toBe(text);
    expect(isFiltered(address)).toBe(true);
  });

  it("words_it_does_not_know_fall_back_to_the_defaults", () => {
    const address = runsAddressOf({
      status: "nonsense",
      started: "1y",
      page: "-2",
      size: "7",
      sort: "name",
    });

    expect(address).toMatchObject({
      statuses: [],
      started: "all",
      page: 1,
      size: 50,
      sort: "started",
    });
  });

  it("a_page_past_the_counted_runs_is_the_last_one_counted", () => {
    const address = runsAddressOf({ page: "900", size: "25" });

    expect(address.page).toBe(400);
  });

  it("an_earlier_address_with_a_phase_opens_the_status_that_counts_it", () => {
    const address = runsAddressOf({ phase: "faulted", status: "cancelled" });

    expect(address.statuses).toEqual(["failed", "cancelled"]);
  });
});
