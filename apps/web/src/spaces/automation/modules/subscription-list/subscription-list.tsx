import { PlusIcon, RadioTowerIcon } from 'lucide-react';
import { Link } from '@/libs/routing/link';
import { subscriptions } from '@/libs/data-access/automation';
import { currentUser } from '@/libs/data-access/identity';
import { Button } from '@/libs/ui/components/button';
import {
  Empty,
  EmptyContent,
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
import { canAuthor } from '../../__shared_context/access';
import { AuthorsOnly } from '../../__shared_context/authors-only';
import { describeFilter } from '../../__shared_context/event-filter';

export async function SubscriptionList() {
  const user = await currentUser();

  if (!canAuthor(user))
    return (
      <AuthorsOnly what="Notifications deliver events to other applications." />
    );

  const list = await subscriptions();
  const create = (
    <Button asChild>
      <Link href="/connections/notifications/new">
        <PlusIcon data-icon="inline-start" />
        New notification
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        level={2}
        title="Notifications"
        description="Other applications told about the events they ask for: what workflows emit, what comes in, and when runs start and end."
        actions={create}
      />
      {list.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RadioTowerIcon />
            </EmptyMedia>
            <EmptyTitle>No notifications yet</EmptyTitle>
            <EmptyDescription>
              Subscribe an endpoint to events by type, for example every failed
              run: io.serverlessworkflow.workflow.faulted.v1.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{create}</EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Takes</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((subscription) => (
                <TableRow key={subscription.id} className="relative">
                  <TableCell>
                    <Link
                      href={`/connections/notifications/${subscription.id}`}
                      className="font-medium after:absolute after:inset-0 hover:underline"
                    >
                      {subscription.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-64 truncate font-mono text-xs">
                    {subscription.endpoint.uri}
                  </TableCell>
                  <TableCell className="max-w-72 truncate text-xs">
                    {describeFilter(subscription.filter)}
                  </TableCell>
                  <TableCell>
                    <Time value={subscription.createdAt} />
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
