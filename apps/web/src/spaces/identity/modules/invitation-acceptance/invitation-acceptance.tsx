import { verifyInvitation } from "@/libs/data-access/identity";
import type { Query } from "@/libs/routing/segment";
import {
  type InvitationCheck,
  InvitationAcceptancePage,
} from "./invitation-acceptance-page";
import { InvitationQuery } from "./query";

const INCOMPLETE: InvitationCheck = {
  kind: "refused",
  reason: "The link is incomplete. Open it from the email as it is.",
};

export async function InvitationAcceptance({
  query,
}: {
  readonly query: Query;
}) {
  const token = InvitationQuery.parse(query).token;

  if (token === "") return <InvitationAcceptancePage check={INCOMPLETE} />;

  const verified = await verifyInvitation(token);
  const check: InvitationCheck = verified.ok
    ? { kind: "valid", token, invitation: verified.value }
    : { kind: "refused", reason: verified.problem.detail };

  return <InvitationAcceptancePage check={check} />;
}
