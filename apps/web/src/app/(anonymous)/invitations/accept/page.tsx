import type { Metadata } from "next";
import { InvitationAcceptance } from "@/spaces/identity/modules/invitation-acceptance";

export const metadata: Metadata = {
  title: "Accept invitation",
  referrer: "no-referrer",
};

export default async function AcceptInvitationPage({
  searchParams,
}: PageProps<"/invitations/accept">) {
  return <InvitationAcceptance query={await searchParams} />;
}
