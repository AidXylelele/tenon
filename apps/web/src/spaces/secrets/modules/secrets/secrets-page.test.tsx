import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { SecretsPage, type SecretsPageProps } from "./secrets-page";
import { SECRETS } from "./secrets.test-support";

const { createSecretAction, replaceSecretAction, deleteSecretAction, success } =
  vi.hoisted(() => ({
    createSecretAction: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    replaceSecretAction: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    deleteSecretAction: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    success: vi.fn(),
  }));

vi.mock("sonner", () => ({ toast: { success } }));
vi.mock("./actions", () => ({
  createSecretAction,
  replaceSecretAction,
  deleteSecretAction,
}));

const DONE = { ok: true, value: undefined };

function show(props: Partial<SecretsPageProps> = {}) {
  render(
    <TooltipProvider>
      <SecretsPage secrets={SECRETS} creating={false} {...props} />
    </TooltipProvider>,
  );
}

function openActionsOf(name: string) {
  const more = screen.getByRole("button", { name: `Actions for ${name}` });
  fireEvent.pointerDown(more, { button: 0, ctrlKey: false });
}

describe("the secrets page", () => {
  beforeEach(() => {
    createSecretAction.mockReset();
    replaceSecretAction.mockReset();
    deleteSecretAction.mockReset();
    success.mockReset();
  });

  it("lists_names_and_who_uses_them_never_values", () => {
    show();

    expect(screen.getByText("CRM_API_TOKEN")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "lead-intake 2.0.1" }),
    ).toBeVisible();
    expect(screen.getByText("Not used yet")).toBeVisible();
  });

  it("a_new_secret_is_typed_hidden_and_saved_by_its_name", async () => {
    createSecretAction.mockResolvedValue(DONE);
    show({ creating: true });

    const name = screen.getByLabelText(/^Name/);
    const value = screen.getByLabelText("Value");
    expect(name).toHaveFocus();
    expect(value).toHaveAttribute("type", "password");
    fireEvent.change(name, { target: { value: "SLACK_URL" } });
    fireEvent.change(value, { target: { value: "https://hooks.slack" } });
    fireEvent.click(screen.getByRole("button", { name: "Save secret" }));

    await waitFor(() => {
      expect(createSecretAction).toHaveBeenCalledWith(
        "SLACK_URL",
        "https://hooks.slack",
      );
    });
  });

  it("a_username_and_password_are_kept_as_json", async () => {
    createSecretAction.mockResolvedValue(DONE);
    show({ creating: true });

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "CRM_LOGIN" },
    });
    fireEvent.click(screen.getByLabelText("A username and a password"));
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "ada" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "s3cret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save secret" }));

    await waitFor(() => {
      expect(createSecretAction).toHaveBeenCalledWith(
        "CRM_LOGIN",
        '{"username":"ada","password":"s3cret"}',
      );
    });
  });

  it("a_bearer_token_is_kept_as_json", async () => {
    replaceSecretAction.mockResolvedValue(DONE);
    show();

    openActionsOf("CRM_API_TOKEN");
    fireEvent.click(screen.getByRole("menuitem", { name: "Replace value…" }));
    fireEvent.click(await screen.findByLabelText("A bearer token"));
    fireEvent.change(screen.getByLabelText("Token"), {
      target: { value: "t0k" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Replace value" }));

    await waitFor(() => {
      expect(replaceSecretAction).toHaveBeenCalledWith(
        "CRM_API_TOKEN",
        '{"token":"t0k"}',
      );
    });
  });

  it("deleting_names_who_uses_it_and_confirms_with_a_toast", async () => {
    deleteSecretAction.mockResolvedValue(DONE);
    show();

    openActionsOf("CRM_API_TOKEN");
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete…" }));
    expect(await screen.findByText(/lead-intake use it/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Delete secret" }));

    await waitFor(() => {
      expect(success).toHaveBeenCalledWith("CRM_API_TOKEN deleted");
    });
  });

  it("with_none_the_empty_state_holds_the_one_create_action", () => {
    show({ secrets: [] });

    const creates = screen.getAllByRole("button", { name: "New secret" });
    expect(creates).toHaveLength(1);
  });
});
