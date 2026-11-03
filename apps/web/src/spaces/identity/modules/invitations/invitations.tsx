import { MailIcon } from 'lucide-react';
import { currentUser, invitations } from '@/libs/data-access/identity';
import { Badge } from '@/libs/ui/components/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/libs/ui/components/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/libs/ui/components/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/libs/ui/components/table';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { Time } from '@/libs/ui/composites/time';
import { isAdministrator } from '@/operations/access-policy';
import { InviteForm } from './invite-form';
import { RevokeButton } from './revoke-button';

const ROLE: Record<string, string> = {
  admin: 'Administrator',
  editor: 'Editor',
  viewer: 'Viewer',
};

export async function Invitations() {
  const user = await currentUser();
  const administrator = isAdministrator(user);

  if (!administrator)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Only administrators invite people</EmptyTitle>
          <EmptyDescription>
            Ask an administrator to invite someone for you.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  const list = await invitations();

  return (
    <>
      <PageHeader
        level={2}
        title="Team"
        description="Invite people by email. A link lets them choose a name and password."
      />
      <Card>
        <CardHeader>
          <CardTitle>Invite someone</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>
      {list.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailIcon />
            </EmptyMedia>
            <EmptyTitle>No pending invitations</EmptyTitle>
            <EmptyDescription>
              Invitations you send appear here until they are accepted.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium">
                    {invitation.email}
                  </TableCell>
                  <TableCell>{ROLE[invitation.role]}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        invitation.status === 'pending'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {invitation.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Time value={invitation.expiresAt} />
                  </TableCell>
                  <TableCell>
                    {invitation.status === 'pending' && (
                      <RevokeButton
                        id={invitation.id}
                        email={invitation.email}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
