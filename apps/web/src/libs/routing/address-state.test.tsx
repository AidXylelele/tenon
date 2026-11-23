import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAddressState } from "./address-state";

const address = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/webhooks",
  useSearchParams: () => new URLSearchParams(address.search),
}));

describe("state kept in the address", () => {
  beforeEach(() => {
    address.search = "";
  });

  it("a_flag_in_the_address_reads_as_set", () => {
    address.search = "test=1&tab=x";
    const { result } = renderHook(() => useAddressState());

    expect(result.current.flagged("test")).toBe(true);
    expect(result.current.flagged("new")).toBe(false);
    expect(result.current.value("tab")).toBe("x");
  });

  it("a_change_replaces_the_address_without_a_new_history_entry", () => {
    address.search = "test=1&tab=x";
    const replace = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useAddressState());

    act(() => {
      result.current.change({ test: null, version: "1.0.0" });
    });

    expect(replace).toHaveBeenCalledWith(
      null,
      "",
      "/webhooks?tab=x&version=1.0.0",
    );
  });

  it("clearing_the_last_entry_leaves_the_bare_path", () => {
    address.search = "new=1";
    const replace = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useAddressState());

    act(() => {
      result.current.change({ new: null });
    });

    expect(replace).toHaveBeenLastCalledWith(null, "", "/webhooks");
  });
});
