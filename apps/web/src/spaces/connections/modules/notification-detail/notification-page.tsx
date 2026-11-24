import { CircleCheckIcon, CircleXIcon, ClockIcon } from "lucide-react";
import type {
  Delivery,
  DeliveryStatus,
  Read,
  SubscriptionDetail,
} from "@/libs/data-access/types";
import { LiveUpdates } from "@/libs/live/live-updates";
import { Badge } from "@/libs/ui/components/badge";
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
import { type RunEvent, whenOf } from "../../__shared_context/notifications";
import { NotificationMenu } from "./notification-menu";

interface NotificationPageProps {
  readonly subscription: Read<SubscriptionDetail>;
  readonly runEvents: readonly RunEvent[];
}

const DELIVERY: Record<DeliveryStatus, StatusLook> = {
  pending: { label: "Pending", tone: "info", icon: ClockIcon },
  delivered: { label: "Delivered", tone: "success", icon: CircleCheckIcon },
  failed: { label: "Failed", tone: "danger", icon: CircleXIcon },
};

const SCHEMES = { basic: "Basic", bearer: "Bearer token" } as const;

export function NotificationPage({
  subscription,
  runEvents,
}: NotificationPageProps) {
  const deliveries = subscription.deliveries;
  const pending = deliveries.some((delivery) => delivery.status === "pending");
  const activity = pending ? "in-flight" : "open";
  const when = whenOf(subscription.filter, runEvents);
  const type = subscription.filter.with["type"];
  const typeText = typeof type === "string" ? type : null;
  const authentication = subscription.endpoint.authentication;
  const authenticationText =
    authentication === undefined
      ? "None"
      : `${SCHEMES[authentication.scheme]}, from the secret ${authentication.secret}`;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {subscription.name}
            <Badge variant="success">On</Badge>
          </span>
        }
        description={
          <>
            Created <AbsoluteTime value={subscription.createdAt} />
          </>
        }
        actions={
          <NotificationMenu id={subscription.id} name={subscription.name} />
        }
      />
      <LiveUpdates activity={activity} />
      <section
        aria-labelledby="what-it-sends"
        className="rounded-lg border bg-card p-4"
      >
        <h2 id="what-it-sends" className="mb-3 text-body font-semibold">
          What it sends
        </h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <dt className="text-muted-foreground">When</dt>
          <dd>
            {when}
            {typeText !== null && (
              <span className="block font-mono text-caption break-all text-muted-foreground">
                type = {typeText}
              </span>
            )}
          </dd>
          <dt className="text-muted-foreground">To</dt>
          <dd className="font-mono break-all">{subscription.endpoint.uri}</dd>
          <dt className="text-muted-foreground">Authentication</dt>
          <dd>{authenticationText}</dd>
          <dt className="text-muted-foreground">If the address refuses</dt>
          <dd>Tenon tries again with the same event id for about a day</dd>
        </dl>
      </section>
      <section aria-labelledby="deliveries" className="flex flex-col gap-3">
        <h2 id="deliveries" className="text-body font-semibold">
          Recent deliveries
        </h2>
        {deliveries.length === 0 ? (
          <EmptyState
            title="Nothing delivered yet"
            description="Each matching event shows here with its delivery, the 50 most recent first."
          />
        ) : (
          <Deliveries deliveries={deliveries} />
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
      <div role="region" aria-label="Recent deliveries" tabIndex={0}>
        <Table className="min-w-[44rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
              <TableHead>Last attempt</TableHead>
              <TableHead>Last error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.map((delivery) => (
              <DeliveryRow key={delivery.eventId} delivery={delivery} />
            ))}
          </TableBody>
        </Table>
      </div>
    </TableFrame>
  );
}

function DeliveryRow({ delivery }: { readonly delivery: Delivery }) {
  const look = DELIVERY[delivery.status];
  const pending = delivery.status === "pending";
  const lastError = delivery.lastError ?? undefined;

  return (
    <TableRow>
      <TableCell>
        <span className="block font-mono text-caption">{delivery.type}</span>
        <span className="block font-mono text-caption text-muted-foreground">
          {delivery.eventId}
        </span>
      </TableCell>
      <TableCell>
        <Status look={look} live={pending} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {delivery.attempts}
      </TableCell>
      <TableCell>
        {delivery.lastAttemptAt === null ? (
          <span className="text-muted-foreground">Not yet</span>
        ) : (
          <AbsoluteTime value={delivery.lastAttemptAt} />
        )}
      </TableCell>
      <TableCell
        className="max-w-72 truncate text-muted-foreground"
        title={lastError}
      >
        {delivery.lastError ?? "—"}
      </TableCell>
    </TableRow>
  );
}
