import {
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  Trash2Icon,
} from "lucide-react";
import { notFound } from "next/navigation";
import { subscription as subscriptionOf } from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { segment } from "@/libs/routing/segment";
import type { Delivery, DeliveryStatus } from "@/libs/data-access/types";
import { RefreshControl } from "@/libs/live/refresh-control";
import {
  Card,
  CardContent,
  CardDescription,
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
import { JsonBlock } from "@/libs/ui/composites/json-block";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { TableFrame } from "@/libs/ui/composites/table-frame";
import { Status, type StatusLook } from "@/libs/ui/composites/status";
import { Time } from "@/libs/ui/composites/time";
import { NOTIFICATIONS_HREF, WEBHOOKS_HREF } from "@/libs/routing/routes";
import { ViewerNotice } from "@/features/viewer-notice";
import { describeFilter } from "../../__shared_context/event-filter";
import { NOTIFICATIONS_PURPOSE } from "../../__shared_context/notifications";
import { deleteSubscriptionAction } from "./actions";
import { Unavailable } from "@/libs/ui/composites/unavailable";

const DELIVERY: Record<DeliveryStatus, StatusLook> = {
  pending: { label: "Pending", tone: "info", icon: ClockIcon },
  delivered: { label: "Delivered", tone: "success", icon: CircleCheckIcon },
  failed: { label: "Failed", tone: "danger", icon: CircleXIcon },
};

export async function NotificationDetail({
  params,
}: {
  readonly params: { readonly id: string };
}) {
  const id = segment(params.id);
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  if (session?.capabilities.author !== true)
    return (
      <>
        <PageHeader title="Notification" />
        <ViewerNotice what={NOTIFICATIONS_PURPOSE} />
      </>
    );

  const subscription = await available(subscriptionOf(id));

  if (subscription === UNAVAILABLE) return <Unavailable />;

  if (subscription === null) notFound();

  const live = subscription.deliveries.some(
    (delivery) => delivery.status === "pending",
  );
  const scheme = subscription.endpoint.authentication;
  const takes = `Takes events where ${describeFilter(subscription.filter)}.`;
  const label = `Delete ${subscription.name}`;
  const title = `${label}?`;
  const remove = deleteSubscriptionAction.bind(null, subscription.id);
  const removed = `${subscription.name} deleted`;
  const activity = live ? "in-flight" : "open";

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Connections", href: WEBHOOKS_HREF },
          { label: "Notifications", href: NOTIFICATIONS_HREF },
          { label: subscription.name },
        ]}
        title={subscription.name}
        description={takes}
        actions={
          <ConfirmAction
            icon={<Trash2Icon />}
            label={label}
            size="icon-sm"
            title={title}
            description="Nothing more is delivered to it, and its pending retries stop."
            actionLabel="Delete notification"
            action={remove}
            success={removed}
          />
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Endpoint</CardTitle>
            <CardDescription>
              {scheme === undefined
                ? "Called without authentication."
                : `Called with ${scheme.scheme} authentication from the secret ${scheme.secret}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="font-mono text-xs break-all">
              {subscription.endpoint.uri}
            </code>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Filter</CardTitle>
            <CardDescription>
              Each attribute matches whole: a pattern, an expression, or data to
              contain.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JsonBlock value={subscription.filter.with} />
          </CardContent>
        </Card>
      </div>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="heading-2">Deliveries</h2>
            <p className="text-sm text-muted-foreground">
              The 50 most recent. A refused delivery is retried with the same
              event id for about a day.
            </p>
          </div>
          <RefreshControl
            activity={activity}
            renderedAt={subscription.readAt}
          />
        </div>
        {subscription.deliveries.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nothing delivered yet. Send a matching event to see it here.
          </p>
        ) : (
          <Deliveries deliveries={subscription.deliveries} />
        )}
      </section>
    </>
  );
}

function Deliveries({
  deliveries,
}: {
  readonly deliveries: readonly Delivery[];
}) {
  return (
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Event</TableHead>
            <TableHead className="text-right">Attempts</TableHead>
            <TableHead>Last attempt</TableHead>
            <TableHead>Last error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.map((delivery) => {
            const look = DELIVERY[delivery.status];
            const pending = delivery.status === "pending";

            return (
              <TableRow key={delivery.eventId}>
                <TableCell>
                  <Status look={look} live={pending} />
                </TableCell>
                <TableCell>
                  <div className="font-mono text-xs">{delivery.type}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {delivery.eventId}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {delivery.attempts}
                </TableCell>
                <TableCell>
                  <Time value={delivery.lastAttemptAt} />
                </TableCell>
                <TableCell
                  className="max-w-72 truncate text-xs text-muted-foreground"
                  title={delivery.lastError ?? undefined}
                >
                  {delivery.lastError ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableFrame>
  );
}
