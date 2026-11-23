import { WebhookIcon } from "lucide-react";
import type { Webhook } from "@/libs/data-access/types";
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
import { CreateWebhook } from "./create-webhook";
import { TestEventDialog } from "./test-event-dialog";
import { WEBHOOK_TABLE, WebhookMenu } from "./webhook-menu";

export interface WebhooksPageProps {
  readonly webhooks: readonly Webhook[];
}

const PURPOSE =
  "Addresses other apps call to start or continue your workflows. A URL is shown once, when it is created.";

export function WebhooksPage({ webhooks }: WebhooksPageProps) {
  const none = webhooks.length === 0;
  const eventTypes = [...new Set(webhooks.map((each) => each.eventType))];
  const create = <CreateWebhook />;

  return (
    <>
      <PageHeader
        title="Webhooks"
        description={PURPOSE}
        actions={
          <>
            <TestEventDialog eventTypes={eventTypes} />
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
          <div
            id={WEBHOOK_TABLE}
            role="region"
            aria-label="Webhooks"
            tabIndex={0}
          >
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
  return (
    <TableRow>
      <TableCell className="font-semibold">{webhook.name}</TableCell>
      <TableCell className="font-mono text-caption">
        {webhook.eventType}
      </TableCell>
      <TableCell>
        <AbsoluteTime value={webhook.createdAt} />
      </TableCell>
      <TableCell>
        <WebhookMenu id={webhook.id} name={webhook.name} />
      </TableCell>
    </TableRow>
  );
}
