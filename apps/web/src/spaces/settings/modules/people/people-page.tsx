import {
  CircleCheckIcon,
  CirclePauseIcon,
  CircleSlashIcon,
  ClockIcon,
  MailIcon,
  UsersIcon,
} from "lucide-react";
import type {
  Invitation,
  InvitationStatus,
  Member,
  MemberStatus,
} from "@/libs/data-access/types";
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
import { EmptyState } from "@/libs/ui/composites/empty-state";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { Status, type StatusLook } from "@/libs/ui/composites/status";
import { TableFrame } from "@/libs/ui/composites/table-frame";
import { AbsoluteTime } from "@/libs/ui/composites/absolute-time";
import { roleLabel } from "@/operations/roles";
import { InvitationMenu } from "./invitation-menu";
import { InviteForm } from "./invite-form";

const STATUS: Record<InvitationStatus, StatusLook> = {
  pending: { label: "Pending", tone: "info", icon: MailIcon },
  accepted: { label: "Accepted", tone: "success", icon: CircleCheckIcon },
  revoked: { label: "Revoked", tone: "neutral", icon: CircleSlashIcon },
  expired: { label: "Expired", tone: "neutral", icon: ClockIcon },
};

const MEMBER: Record<MemberStatus, StatusLook> = {
  active: { label: "Active", tone: "success", icon: CircleCheckIcon },
  suspended: { label: "Suspended", tone: "warning", icon: CirclePauseIcon },
  invited: { label: "Invited", tone: "info", icon: MailIcon },
};

export interface PeoplePageProps {
  readonly people: readonly Member[];
  readonly list: readonly Invitation[];
}

export function PeoplePage({ people, list }: PeoplePageProps) {
  const sent = list.filter((invitation) => invitation.status !== "accepted");

  return (
    <>
      <PageHeader
        level={2}
        title="People"
        description="Who has access and with which role. Invite people by email; a link lets them choose a name and password."
      />
      <section aria-labelledby="members" className="flex flex-col gap-3">
        <h3 id="members" className="heading-3">
          Members
        </h3>
        {people.length === 0 ? (
          <EmptyState
            icon={<UsersIcon />}
            title="No members yet"
            description="People appear here once they accept an invitation."
          />
        ) : (
          <TableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Since</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((member) => (
                  <MemberRow key={member.id} member={member} />
                ))}
              </TableBody>
            </Table>
          </TableFrame>
        )}
      </section>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Invite someone</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>
      <h3 className="heading-3">Invitations</h3>
      {sent.length === 0 ? (
        <EmptyState
          icon={<MailIcon />}
          title="No open invitations"
          description="Invitations you send appear here until they are accepted."
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
              {sent.map((invitation) => (
                <InvitationRow key={invitation.id} invitation={invitation} />
              ))}
            </TableBody>
          </Table>
        </TableFrame>
      )}
    </>
  );
}

function MemberRow({ member }: { readonly member: Member }) {
  const look = MEMBER[member.status];
  const role = roleLabel(member.role);

  return (
    <TableRow>
      <TableCell>
        {member.name === null ? (
          <span className="block font-medium">{member.email}</span>
        ) : (
          <>
            <span className="block font-medium">{member.name}</span>
            <span className="block text-xs text-muted-foreground">
              {member.email}
            </span>
          </>
        )}
      </TableCell>
      <TableCell className="hidden sm:table-cell">{role}</TableCell>
      <TableCell>
        <Status look={look} />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <AbsoluteTime value={member.since} />
      </TableCell>
    </TableRow>
  );
}

function InvitationRow({ invitation }: { readonly invitation: Invitation }) {
  const look = STATUS[invitation.status];
  const pending = invitation.status === "pending";
  const role = roleLabel(invitation.role);

  return (
    <TableRow>
      <TableCell className="font-medium">{invitation.email}</TableCell>
      <TableCell className="hidden sm:table-cell">{role}</TableCell>
      <TableCell>
        <Status look={look} />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <AbsoluteTime value={invitation.expiresAt} />
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <AbsoluteTime value={invitation.createdAt} />
      </TableCell>
      <TableCell>
        {pending && (
          <InvitationMenu id={invitation.id} email={invitation.email} />
        )}
      </TableCell>
    </TableRow>
  );
}
