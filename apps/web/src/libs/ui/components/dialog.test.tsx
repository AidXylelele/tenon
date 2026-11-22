import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "./dialog";

describe("a dialog's footer", () => {
  it("its_close_button_closes_the_dialog", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Version 1.2.0</DialogTitle>
          <DialogDescription>Published yesterday.</DialogDescription>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>,
    );
    const close = screen.getByRole("button", { name: "Close" });

    act(() => {
      fireEvent.click(close);
    });

    const dialog = screen.queryByRole("dialog");
    expect(dialog).not.toBeInTheDocument();
  });
});
