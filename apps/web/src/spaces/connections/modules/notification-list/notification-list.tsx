import { PlusIcon, RadioTowerIcon } from "lucide-react";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { Link } from "@/libs/routing/link";
import { subscriptions } from "@/libs/data-access/automation";
import { currentSession } from "@/libs/data-access/identity";
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
import { Time } from "@/libs/ui/composites/time";
import { NEW_NOTIFICATION_HREF, notificationHref } from "@/libs/routing/routes";
import { ViewerNotice } from "@/features/viewer-notice";
import { describeFilter } from "../../__shared_context/event-filter";
import { NOTIFICATIONS_PURPOSE } from "../../__shared_context/notifications";
import { Unavailable } from "@/libs/ui/composites/unavailable";

export async function NotificationList() {
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  if (session?.capabilities.author !== true)
    return <ViewerNotice what={NOTIFICATIONS_PURPOSE} />;

  const list = await available(subscriptions());

  if (list === UNAVAILABLE) return <Unavailable />;

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
        level={2}
        title="Notifications"
        description="Other applications told about the events they ask for: what workflows emit, what comes in, and when runs start and end."
        actions={create}
      />
      {list.length === 0 ? (
        <EmptyState
          icon={<RadioTowerIcon />}
          title="No notifications yet"
          description="Subscribe an endpoint to events by type, for example to every run that fails."
          action={create}
        />
      ) : (
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Endpoint</TableHead>
                <TableHead>Takes</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((subscription) => (
                <TableRow key={subscription.id} className="relative">
                  <TableCell>
                    <Link
                      href={notificationHref(subscription.id)}
                      className="font-medium after:absolute after:inset-0 hover:underline"
                    >
                      {subscription.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden max-w-64 truncate font-mono text-xs md:table-cell">
                    {subscription.endpoint.uri}
                  </TableCell>
                  <TableCell className="max-w-72 truncate text-xs">
                    {describeFilter(subscription.filter)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Time value={subscription.createdAt} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableFrame>
      )}
    </>
  );
}
