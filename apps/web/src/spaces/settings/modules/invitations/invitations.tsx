import {
  CircleCheckIcon,
  CircleSlashIcon,
  ClockIcon,
  MailIcon,
  XIcon,
} from "lucide-react";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession, invitations } from "@/libs/data-access/identity";
import type { Invitation, InvitationStatus } from "@/libs/data-access/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/libs/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/libs/ui/components/table";
import { ConfirmAction } from "@/libs/ui/composites/confirm-action";
import { EmptyState } from "@/libs/ui/composites/empty-state";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { Status, type StatusLook } from "@/libs/ui/composites/status";
import { TableFrame } from "@/libs/ui/composites/table-frame";
import { Time } from "@/libs/ui/composites/time";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { roleLabel } from "@/operations/roles";
import { revokeAction } from "./actions";
import { InviteForm } from "./invite-form";

const STATUS: Record<InvitationStatus, StatusLook> = {
  pending: { label: "Pending", tone: "info", icon: MailIcon },
  accepted: { label: "Accepted", tone: "success", icon: CircleCheckIcon },
  revoked: { label: "Revoked", tone: "neutral", icon: CircleSlashIcon },
  expired: { label: "Expired", tone: "neutral", icon: ClockIcon },
};

export async function Invitations() {
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  const administrator = session?.capabilities.administrator === true;

  if (!administrator)
    return (
      <EmptyState
        title="Only administrators invite people"
        description="Ask an administrator to invite someone for you."
      />
    );

  const list = await available(invitations());

  if (list === UNAVAILABLE) return <Unavailable />;

  return (
    <>
      <PageHeader
        level={2}
        title="Invitations"
        description="Invite people by email. A link lets them choose a name and password."
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Invite someone</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>
      {list.length === 0 ? (
        <EmptyState
          icon={<MailIcon />}
          title="No invitations yet"
          description="Invitations you send appear here with what became of them."
        />
      ) : (
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead className="hidden sm:table-cell">Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Expires</TableHead>
                <TableHead className="hidden lg:table-cell">Created</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((invitation) => (
                <InvitationRow key={invitation.id} invitation={invitation} />
              ))}
            </TableBody>
          </Table>
        </TableFrame>
      )}
    </>
  );
}

function InvitationRow({ invitation }: { readonly invitation: Invitation }) {
  const look = STATUS[invitation.status];
  const pending = invitation.status === "pending";
  const role = roleLabel(invitation.role);
  const label = `Revoke the invitation for ${invitation.email}`;
  const title = `${label}?`;
  const revoke = revokeAction.bind(null, invitation.id);
  const revoked = `Invitation for ${invitation.email} revoked`;

  return (
    <TableRow>
      <TableCell className="font-medium">{invitation.email}</TableCell>
      <TableCell className="hidden sm:table-cell">{role}</TableCell>
      <TableCell>
        <Status look={look} />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Time value={invitation.expiresAt} />
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <Time value={invitation.createdAt} />
      </TableCell>
      <TableCell>
        {pending && (
          <ConfirmAction
            icon={<XIcon />}
            label={label}
            size="icon-sm"
            title={title}
            description="The link stops working. You can invite the address again."
            actionLabel="Revoke invitation"
            action={revoke}
            success={revoked}
          />
        )}
      </TableCell>
    </TableRow>
  );
}
