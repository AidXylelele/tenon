import { Trash2Icon, WebhookIcon } from "lucide-react";
import { webhooks } from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
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
import { ViewerNotice } from "@/features/viewer-notice";
import { deleteWebhookAction } from "./actions";
import { CreateWebhook } from "./create-webhook";
import { Unavailable } from "@/libs/ui/composites/unavailable";

export async function Webhooks() {
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  if (session?.capabilities.author !== true)
    return (
      <ViewerNotice what="Webhooks let other applications send events in." />
    );

  const list = await available(webhooks());

  if (list === UNAVAILABLE) return <Unavailable />;

  return (
    <>
      <PageHeader
        level={2}
        title="Webhooks"
        description="Addresses other applications call to send events in: a form submission, a payment, a new lead. A workflow that listens for the event starts or continues."
        actions={<CreateWebhook />}
      />
      {list.length === 0 ? (
        <EmptyState
          icon={<WebhookIcon />}
          title="No webhooks yet"
          description="Create one, give its URL to the other application, and start a workflow when an event of its type arrives."
        />
      ) : (
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Event type</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((webhook) => (
                <WebhookRow key={webhook.id} webhook={webhook} />
              ))}
            </TableBody>
          </Table>
        </TableFrame>
      )}
      <p className="text-xs text-muted-foreground">
        A webhook&apos;s URL is shown once, when it is created. The list keeps
        names and types only.
      </p>
    </>
  );
}

function WebhookRow({ webhook }: { readonly webhook: Webhook }) {
  const label = `Delete ${webhook.name}`;
  const title = `${label}?`;
  const remove = deleteWebhookAction.bind(null, webhook.id);
  const removed = `${webhook.name} deleted`;

  return (
    <TableRow>
      <TableCell className="font-medium">{webhook.name}</TableCell>
      <TableCell className="font-mono text-xs">{webhook.eventType}</TableCell>
      <TableCell className="hidden sm:table-cell">
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
