import { PlusIcon, WaypointsIcon } from 'lucide-react';
import { Link } from '@/libs/routing/link';
import { workflows } from '@/libs/data-access/automation';
import { currentUser } from '@/libs/data-access/identity';
import type { WorkflowStatus } from '@/libs/data-access/types';
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
import { canAuthor } from '../../__shared_context/access';
import { workflowHref } from '../../__shared_context/links';
import { Status } from '../../__shared_context/vocabulary';

interface WorkflowListProps {
  readonly status: WorkflowStatus;
  readonly cursor?: string;
}

export async function WorkflowList({ status, cursor }: WorkflowListProps) {
  const [user, page] = await Promise.all([
    currentUser(),
    workflows(status, cursor),
  ]);
  const author = canAuthor(user);
  const actions = author ? (
    <Button asChild>
      <Link href="/workflows/new">
        <PlusIcon data-icon="inline-start" />
        New workflow
      </Link>
    </Button>
  ) : undefined;

  return (
    <>
      <PageHeader
        title="Workflows"
        description="Automations by namespace and name. Each publish adds a version; runs use the current one."
        actions={actions}
      />
      <nav className="flex gap-1 border-b text-sm" aria-label="Workflow status">
        <Tab href="/workflows" active={status === 'active'}>
          Active
        </Tab>
        <Tab href="/workflows?status=archived" active={status === 'archived'}>
          Archived
        </Tab>
      </nav>
      {page.items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WaypointsIcon />
            </EmptyMedia>
            <EmptyTitle>
              {status === 'active' ? 'No workflows yet' : 'Nothing archived'}
            </EmptyTitle>
            <EmptyDescription>
              {status === 'active'
                ? 'Build one from steps without code, or paste a document in the Open Workflow format.'
                : 'Archived workflows keep their versions and runs, and start nothing new.'}
            </EmptyDescription>
          </EmptyHeader>
          {author && status === 'active' && (
            <EmptyContent>
              <Button asChild>
                <Link href="/workflows/new">Build a workflow</Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Current version
                </TableHead>
                <TableHead>Starts by itself</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((workflow) => (
                <TableRow
                  key={`${workflow.namespace}/${workflow.name}`}
                  className="relative"
                >
                  <TableCell>
                    <Link
                      href={workflowHref(workflow.namespace, workflow.name)}
                      className="font-medium after:absolute after:inset-0 hover:underline"
                    >
                      {workflow.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {workflow.namespace}
                    </div>
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">
                    {workflow.currentVersion ?? '—'}
                  </TableCell>
                  <TableCell>
                    {workflow.status === 'archived' ? (
                      <Status tone="ended" label="Archived" />
                    ) : workflow.on ? (
                      <Status tone="done" label="On" />
                    ) : (
                      <Status tone="idle" label="Off" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {page.next !== null && (
        <div className="flex justify-end">
          <Button variant="outline" asChild>
            <Link
              href={`/workflows?status=${status}&cursor=${encodeURIComponent(page.next)}`}
            >
              Next page
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  readonly href: string;
  readonly active: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? '-mb-px border-b-2 border-foreground px-3 py-2 font-medium'
          : '-mb-px border-b-2 border-transparent px-3 py-2 text-muted-foreground hover:text-foreground'
      }
    >
      {children}
    </Link>
  );
}
