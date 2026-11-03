import { notFound } from 'next/navigation';
import { subscription as subscriptionOf } from '@/libs/data-access/automation';
import { currentUser } from '@/libs/data-access/identity';
import type { Delivery } from '@/libs/data-access/types';
import { RefreshControl } from '@/libs/live/refresh-control';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/libs/ui/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/libs/ui/components/table';
import { JsonBlock } from '@/libs/ui/composites/json-block';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { Time } from '@/libs/ui/composites/time';
import { canAuthor } from '../../__shared_context/access';
import { AuthorsOnly } from '../../__shared_context/authors-only';
import { DeleteButton } from '../../__shared_context/delete-button';
import { describeFilter } from '../../__shared_context/event-filter';
import {
  deliveryLabel,
  deliveryTone,
  Status,
} from '../../__shared_context/vocabulary';
import { deleteSubscriptionAction } from './actions';

// A subscription and its 50 most recent deliveries, live while any is being retried (spec
// US7 scenario 4).
export async function SubscriptionDetail({ id }: { readonly id: string }) {
  const user = await currentUser();

  if (!canAuthor(user))
    return (
      <AuthorsOnly what="Subscriptions deliver events to other applications." />
    );

  const subscription = await subscriptionOf(id);

  if (subscription === null) notFound();

  const live = subscription.deliveries.some(
    (delivery) => delivery.status === 'pending',
  );
  const scheme = subscription.endpoint.authentication;

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Connections', href: '/connections/webhooks' },
          { label: 'Notifications', href: '/connections/notifications' },
          { label: subscription.name },
        ]}
        title={subscription.name}
        description={`Takes events where ${describeFilter(subscription.filter)}.`}
        actions={
          <DeleteButton
            what={subscription.name}
            consequence="Nothing more is delivered to it, and its pending retries stop."
            onDelete={deleteSubscriptionAction.bind(null, subscription.id)}
          />
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Endpoint</CardTitle>
            <CardDescription>
              {scheme === undefined
                ? 'Called without authentication.'
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
            <h2 className="text-base font-semibold">Deliveries</h2>
            <p className="text-sm text-muted-foreground">
              The 50 most recent. A refused delivery is retried with the same
              event id for about a day.
            </p>
          </div>
          <RefreshControl
            activity={live ? 'in-flight' : 'open'}
            renderedAt={subscription.readAt}
          />
        </div>
        {subscription.deliveries.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
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
    <div className="overflow-x-auto rounded-lg border">
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
          {deliveries.map((delivery) => (
            <TableRow key={delivery.eventId}>
              <TableCell>
                <Status
                  tone={deliveryTone(delivery.status)}
                  label={deliveryLabel(delivery.status)}
                  live={delivery.status === 'pending'}
                />
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
                {delivery.lastError ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
