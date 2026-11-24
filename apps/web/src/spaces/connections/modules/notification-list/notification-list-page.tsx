import { BellIcon, PlusIcon } from "lucide-react";
import type { Subscription } from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { NEW_NOTIFICATION_HREF, notificationHref } from "@/libs/routing/routes";
import { Button } from "@/libs/ui/components/button";
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
import { TableFrame } from "@/libs/ui/composites/table-frame";
import { AbsoluteTime } from "@/libs/ui/composites/absolute-time";
import { type RunEvent, whenOf } from "../../__shared_context/notifications";

interface NotificationListPageProps {
  readonly subscriptions: readonly Subscription[];
  readonly runEvents: readonly RunEvent[];
}

export function NotificationListPage({
  subscriptions,
  runEvents,
}: NotificationListPageProps) {
  const none = subscriptions.length === 0;
  const create = (
    <Button asChild>
      <Link href={NEW_NOTIFICATION_HREF}>
        <PlusIcon data-icon="inline-start" />
        New notification
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Other apps Tenon tells when something happens to your runs or an event comes in."
        actions={none ? undefined : create}
      />
      {none ? (
        <EmptyState
          icon={<BellIcon />}
          title="No notifications yet"
          description="Tell another app when a run fails, succeeds or starts, or when an event of a type you choose arrives."
          action={create}
        />
      ) : (
        <TableFrame>
          <div role="region" aria-label="Notifications" tabIndex={0}>
            <Table className="min-w-[40rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Sends to</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => (
                  <NotificationRow
                    key={subscription.id}
                    subscription={subscription}
                    runEvents={runEvents}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </TableFrame>
      )}
    </>
  );
}

function NotificationRow({
  subscription,
  runEvents,
}: {
  readonly subscription: Subscription;
  readonly runEvents: readonly RunEvent[];
}) {
  const href = notificationHref(subscription.id);
  const when = whenOf(subscription.filter, runEvents);

  return (
    <TableRow className="relative">
      <TableCell>
        <Link
          href={href}
          className="font-semibold after:absolute after:inset-0 hover:underline"
        >
          {subscription.name}
        </Link>
      </TableCell>
      <TableCell className="max-w-72 truncate">{when}</TableCell>
      <TableCell className="max-w-64 truncate font-mono text-caption">
        {subscription.endpoint.uri}
      </TableCell>
      <TableCell>
        <AbsoluteTime value={subscription.createdAt} />
      </TableCell>
    </TableRow>
  );
}
