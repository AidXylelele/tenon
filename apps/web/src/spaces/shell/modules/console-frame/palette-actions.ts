import {
  KeyRoundIcon,
  type LucideIcon,
  MailIcon,
  PlayIcon,
  PlusIcon,
  SendIcon,
  WebhookIcon,
} from "lucide-react";
import type { Capabilities } from "@/libs/data-access/types";
import {
  INVITATIONS_HREF,
  NEW_WORKFLOW_HREF,
  SECRETS_HREF,
  TEST_EVENT_HREF,
  WEBHOOKS_HREF,
} from "@/libs/routing/routes";

type Access = keyof Capabilities | null;

export type PaletteAction =
  | {
      readonly kind: "link";
      readonly label: string;
      readonly href: string;
      readonly icon: LucideIcon;
      readonly access: Access;
    }
  | {
      readonly kind: "run";
      readonly label: string;
      readonly icon: LucideIcon;
      readonly access: Access;
    }
  | { readonly kind: "theme"; readonly access: Access };

export const ACTIONS: readonly PaletteAction[] = [
  {
    kind: "link",
    label: "New workflow",
    href: NEW_WORKFLOW_HREF,
    icon: PlusIcon,
    access: "author",
  },
  {
    kind: "run",
    label: "Run a workflow…",
    icon: PlayIcon,
    access: "operator",
  },
  {
    kind: "link",
    label: "Send a test event",
    href: TEST_EVENT_HREF,
    icon: SendIcon,
    access: "author",
  },
  {
    kind: "link",
    label: "New secret",
    href: SECRETS_HREF,
    icon: KeyRoundIcon,
    access: "author",
  },
  {
    kind: "link",
    label: "New webhook",
    href: WEBHOOKS_HREF,
    icon: WebhookIcon,
    access: "author",
  },
  {
    kind: "link",
    label: "Invite someone",
    href: INVITATIONS_HREF,
    icon: MailIcon,
    access: "administrator",
  },
  { kind: "theme", access: null },
];
