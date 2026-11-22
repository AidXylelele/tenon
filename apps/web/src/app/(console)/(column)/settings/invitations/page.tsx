import type { Metadata } from "next";
import { Invitations } from "@/spaces/settings/modules/invitations";

export const metadata: Metadata = { title: "Invitations" };

export default function InvitationsPage() {
  return <Invitations />;
}
