import { LSPClient } from "@codemirror/lsp-client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NewDocumentResult } from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import type { DraftRevision, DraftWrite } from "@/libs/data-access/types";
import { NamingDialog } from "./naming-dialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const NAME_RULE =
  "1 to 63 letters, digits or hyphens, starting and ending with a letter or a digit. We suggest lowercase.";
const ADA = { id: "u1", name: "Ada Lovelace" };
const GRACE = { id: "u2", name: "Grace Hopper" };
const TEXT = "document:\n  name: leads\ndo: []\n";
const LEADS = { namespace: "default", name: "leads" };

function answering(answer: NewDocumentResult) {
  const client = new LSPClient();
  const request = vi.spyOn(client, "request").mockResolvedValue(answer);
  return { client, request };
}

function draftBy(by: typeof ADA): DraftRevision {
  const savedAt = "2026-11-22T10:00:00Z";
  const draft = { source: TEXT, layout: {}, savedBy: by, savedAt };
  return { draft, etag: '"3"' };
}

function name(client: LSPClient, typed: string, written: DraftWrite) {
  const onNamed = vi.fn(() => Promise.resolve(written));
  const onOpen = vi.fn();
  render(
    <NamingDialog
      client={client}
      userId={ADA.id}
      onNamed={onNamed}
      onOpen={onOpen}
    />,
  );
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: typed },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open the editor" }));
  return { onNamed, onOpen };
}

describe("naming a new workflow", () => {
  it("an_empty_name_is_refused_before_the_server_is_asked", async () => {
    const { client, request } = answering({ kind: "text", text: "" });
    name(client, " ", { kind: "saved", revision: draftBy(ADA) });

    expect(await screen.findByText("Give the workflow a name.")).toBeVisible();
    expect(request).not.toHaveBeenCalled();
  });

  it("a_name_the_server_refuses_says_how_to_write_it", async () => {
    const { client } = answering({ kind: "refused", params: ["name"] });
    name(client, "Lead Intake", { kind: "saved", revision: draftBy(ADA) });

    expect(await screen.findByText(NAME_RULE)).toBeVisible();
  });

  it("an_accepted_name_opens_its_new_draft", async () => {
    const { client } = answering({ kind: "text", text: TEXT });
    const revision = draftBy(ADA);
    const { onNamed, onOpen } = name(client, "leads", {
      kind: "saved",
      revision,
    });

    await waitFor(() => {
      expect(onOpen).toHaveBeenCalledWith(LEADS, revision);
    });
    expect(onNamed).toHaveBeenCalledWith({ ...LEADS, source: TEXT });
  });

  it("a_name_another_person_is_writing_is_refused_with_who", async () => {
    const { client } = answering({ kind: "text", text: TEXT });
    const current = draftBy(GRACE);
    const { onOpen } = name(client, "leads", { kind: "conflict", current });

    const refusal = await screen.findByText(/is being written by Grace Hopper/);
    const own = screen.queryByRole("button", { name: "Open your draft" });

    expect(refusal).toBeVisible();
    expect(own).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("the_person's_own_draft_of_that_name_can_be_opened", async () => {
    const { client } = answering({ kind: "text", text: TEXT });
    const current = draftBy(ADA);
    const { onOpen } = name(client, "leads", { kind: "conflict", current });

    const own = await screen.findByRole("button", { name: "Open your draft" });
    fireEvent.click(own);

    expect(onOpen).toHaveBeenCalledWith(LEADS, current);
  });
});
