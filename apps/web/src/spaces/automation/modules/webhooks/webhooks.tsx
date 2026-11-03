import { WebhookIcon } from 'lucide-react';
import { webhooks } from '@/libs/data-access/automation';
import { currentUser } from '@/libs/data-access/identity';
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
import { canAuthor } from '../../__shared_context/access';
import { AuthorsOnly } from '../../__shared_context/authors-only';
import { DeleteButton } from '../../__shared_context/delete-button';
import { deleteWebhookAction } from './actions';
import { CreateWebhook } from './create-webhook';

export async function Webhooks() {
  const user = await currentUser();

  if (!canAuthor(user))
    return (
      <AuthorsOnly what="Webhooks let other applications send events in." />
    );

  const list = await webhooks();

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="URLs other applications call to send events in: a form submission, a payment, a new lead."
        actions={<CreateWebhook />}
      />
      {list.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WebhookIcon />
            </EmptyMedia>
            <EmptyTitle>No webhooks yet</EmptyTitle>
            <EmptyDescription>
              Create one, give its URL to the other application, and start a
              workflow when an event of its type arrives.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Event type</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((webhook) => (
                <TableRow key={webhook.id}>
                  <TableCell className="font-medium">{webhook.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {webhook.eventType}
                  </TableCell>
                  <TableCell>
                    <Time value={webhook.createdAt} />
                  </TableCell>
                  <TableCell>
                    <DeleteButton
                      what={webhook.name}
                      consequence="Its URL stops working at once; calls to it are refused as unknown."
                      onDelete={deleteWebhookAction.bind(null, webhook.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        A webhook&apos;s URL is shown once, when it is created. The list keeps
        names and types only.
      </p>
    </>
  );
}
