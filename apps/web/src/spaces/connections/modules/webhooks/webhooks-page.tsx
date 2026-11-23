import { Trash2Icon, WebhookIcon } from "lucide-react";
import type { Webhook } from "@/libs/data-access/types";
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
import { TableFrame } from "@/libs/ui/composites/table-frame";
import { Time } from "@/libs/ui/composites/time";
import { deleteWebhookAction } from "./actions";
import { CreateWebhook } from "./create-webhook";
import { TestEventDialog } from "./test-event-dialog";

export interface WebhooksPageProps {
  readonly webhooks: readonly Webhook[];
  readonly testing: boolean;
  readonly creating: boolean;
}

const PURPOSE =
  "Addresses other apps call to start or continue your workflows. A URL is shown once, when it is created.";

export function WebhooksPage({
  webhooks,
  testing,
  creating,
}: WebhooksPageProps) {
  const none = webhooks.length === 0;
  const eventTypes = [...new Set(webhooks.map((each) => each.eventType))];
  const create = <CreateWebhook defaultOpen={creating} />;

  return (
    <>
      <PageHeader
        title="Webhooks"
        description={PURPOSE}
        actions={
          <>
            <TestEventDialog eventTypes={eventTypes} defaultOpen={testing} />
            {!none && create}
          </>
        }
      />
      {none ? (
        <EmptyState
          icon={<WebhookIcon />}
          title="No webhooks yet"
          description="Create one, give its URL to the other app, and a workflow that waits for its event starts or goes on when the app calls it."
          action={create}
        />
      ) : (
        <TableFrame>
          <div role="region" aria-label="Webhooks" tabIndex={0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Event type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <WebhookRow key={webhook.id} webhook={webhook} />
                ))}
              </TableBody>
            </Table>
          </div>
        </TableFrame>
      )}
    </>
  );
}

function WebhookRow({ webhook }: { readonly webhook: Webhook }) {
  const label = `Delete ${webhook.name}`;
  const title = `Delete the webhook ${webhook.name}?`;
  const remove = deleteWebhookAction.bind(null, webhook.id);
  const removed = `${webhook.name} deleted`;

  return (
    <TableRow>
      <TableCell className="font-semibold">{webhook.name}</TableCell>
      <TableCell className="font-mono text-caption">
        {webhook.eventType}
      </TableCell>
      <TableCell>
        <Time value={webhook.createdAt} />
      </TableCell>
      <TableCell>
        <ConfirmAction
          icon={<Trash2Icon />}
          label={label}
          size="icon-sm"
          title={title}
          description="Its URL stops working at once; calls to it are refused as unknown."
          actionLabel="Delete webhook"
          action={remove}
          success={removed}
        />
      </TableCell>
    </TableRow>
  );
}
