import {
  ActivityIcon,
  ArrowRightIcon,
  CircleAlertIcon,
  PlusIcon,
  SendIcon,
  WaypointsIcon,
  WebhookIcon,
} from 'lucide-react';
import { Link } from '@/libs/routing/link';
import { instances, workflows } from '@/libs/data-access/automation';
import { currentUser } from '@/libs/data-access/identity';
import type {
  InstanceSummary,
  Page,
  Phase,
  Read,
} from '@/libs/data-access/types';
import { RefreshControl } from '@/libs/live/refresh-control';
import { Button } from '@/libs/ui/components/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/libs/ui/components/card';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { Status, toneClasses } from '@/libs/ui/composites/status';
import { Duration, Time } from '@/libs/ui/composites/time';
import { canAuthor } from '@/operations/access-policy';
import {
  instanceHref,
  INSTANCES_HREF,
  instancesHref,
  NEW_WORKFLOW_HREF,
  TEST_EVENT_HREF,
  WEBHOOKS_HREF,
  workflowHref,
  WORKFLOWS_HREF,
} from '@/operations/app-routes';
import {
  phaseLabel,
  PHASES,
  phaseStatusOf,
  phaseTone,
} from '@/operations/run-progress';

const DAY_MS = 24 * 3_600_000;

// What the platform is doing (FR-025): what starts by itself, the last day's runs by phase,
// what failed and what is running now.
export async function Overview() {
  const [user, active, day, running, waiting] = await Promise.all([
    currentUser(),
    workflows('active'),
    lastDay(),
    instances({ phase: 'running', limit: 8 }),
    instances({ phase: 'waiting', limit: 8 }),
  ]);
  const author = canAuthor(user);
  const scheduled = active.items.filter((workflow) => workflow.on);
  const counts = countByPhase(day.items);
  const failed = day.items
    .filter((instance) => instance.phase === 'faulted')
    .slice(0, 6);
  const inFlight = [...running.items, ...waiting.items].slice(0, 8);
  const more = day.next !== null;
  const firstName = user?.name.split(' ')[0];
  const faultedRuns = instancesHref({ phase: 'faulted' });
  const runningRuns = instancesHref({ phase: 'running' });

  return (
    <>
      <PageHeader
        title={firstName === undefined ? 'Overview' : `Hello, ${firstName}`}
        description="What your automations are doing, live."
        actions={
          <RefreshControl
            activity={inFlight.length > 0 ? 'in-flight' : 'open'}
            renderedAt={day.readAt}
          />
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Workflows"
          value={active.items.length}
          hint={`${scheduled.length} start by themselves`}
          href={WORKFLOWS_HREF}
          icon={<WaypointsIcon />}
          tone="bg-violet-500/12 text-violet-600 dark:text-violet-300"
        />
        <Tile
          label="Runs in the last day"
          value={day.items.length}
          suffix={more ? '+' : ''}
          hint={`${counts.get('completed') ?? 0} completed`}
          href={INSTANCES_HREF}
          icon={<ActivityIcon />}
          tone="bg-sky-500/12 text-sky-600 dark:text-sky-300"
        />
        <Tile
          label="Faulted in the last day"
          value={counts.get('faulted') ?? 0}
          hint={
            (counts.get('faulted') ?? 0) === 0
              ? 'Nothing failed'
              : 'Open them to see where'
          }
          href={faultedRuns}
          icon={<CircleAlertIcon />}
          tone={
            (counts.get('faulted') ?? 0) > 0
              ? 'bg-red-500/12 text-red-600 dark:text-red-400'
              : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
          }
        />
        <Tile
          label="Running now"
          value={inFlight.length}
          hint={`${waiting.items.length} waiting for an event or a time`}
          href={runningRuns}
          icon={<ActivityIcon />}
          tone="bg-amber-500/14 text-amber-700 dark:text-amber-300"
        />
      </div>
      {day.items.length > 0 && (
        <PhaseBar counts={counts} total={day.items.length} />
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>
              Runs that faulted in the last day.
            </CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href={faultedRuns}>
                  All
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {failed.length === 0 ? (
              <Quiet>No run faulted. All good.</Quiet>
            ) : (
              <RunRows runs={failed} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Running now</CardTitle>
            <CardDescription>
              Runs working or waiting, newest first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inFlight.length === 0 ? (
              <Quiet>Nothing is running.</Quiet>
            ) : (
              <RunRows runs={inFlight} />
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Start by themselves</CardTitle>
          <CardDescription>
            Workflows turned on: their schedule or their event starts runs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scheduled.length === 0 ? (
            <Quiet>
              None yet. Give a workflow a schedule or an event, publish it, and
              turn it on.
            </Quiet>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {scheduled.map((workflow) => (
                <li key={`${workflow.namespace}/${workflow.name}`}>
                  <Link
                    href={workflowHref(workflow.namespace, workflow.name)}
                    className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <WaypointsIcon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {workflow.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {workflow.namespace}, version {workflow.currentVersion}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {author && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Quick
            href={NEW_WORKFLOW_HREF}
            icon={<PlusIcon />}
            title="Build a workflow"
            text="From steps, without code."
          />
          <Quick
            href={WEBHOOKS_HREF}
            icon={<WebhookIcon />}
            title="Create a webhook"
            text="Let another application send events in."
          />
          <Quick
            href={TEST_EVENT_HREF}
            icon={<SendIcon />}
            title="Send a test event"
            text="Try a trigger or a waiting step."
          />
        </div>
      )}
    </>
  );
}

function Tile({
  label,
  value,
  suffix = '',
  hint,
  href,
  icon,
  tone,
}: {
  readonly label: string;
  readonly value: number;
  readonly suffix?: string;
  readonly hint: string;
  readonly href: string;
  readonly icon: React.ReactNode;
  readonly tone: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-md"
    >
      <span className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={`flex size-8 items-center justify-center rounded-lg [&_svg]:size-4 ${tone}`}
        >
          {icon}
        </span>
      </span>
      <span className="text-3xl font-semibold tracking-tight tabular-nums">
        {value}
        {suffix}
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </Link>
  );
}

function PhaseBar({
  counts,
  total,
}: {
  readonly counts: ReadonlyMap<Phase, number>;
  readonly total: number;
}) {
  const present = PHASES.filter((phase) => (counts.get(phase) ?? 0) > 0);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
      <div className="text-sm font-medium">The last day by phase</div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label="Runs of the last day by phase"
      >
        {present.map((phase) => (
          <span
            key={phase}
            className={toneClasses(phaseTone(phase)).dot}
            style={{ width: `${((counts.get(phase) ?? 0) / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {present.map((phase) => (
          <li key={phase} className="flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full ${toneClasses(phaseTone(phase)).dot}`}
            />
            {phaseLabel(phase)}{' '}
            <span className="font-medium text-foreground tabular-nums">
              {counts.get(phase)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunRows({ runs }: { readonly runs: readonly InstanceSummary[] }) {
  return (
    <ol className="flex flex-col divide-y">
      {runs.map((run) => (
        <li key={run.id}>
          <Link
            href={instanceHref(run.id)}
            className="flex items-center gap-3 py-2.5 hover:bg-muted/40"
          >
            <Status
              {...phaseStatusOf(run.phase)}
              className="w-24 shrink-0 text-xs"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {run.name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              <Time value={run.startedAt ?? run.createdAt} />
            </span>
            <span className="w-16 shrink-0 text-right text-xs">
              <Duration from={run.startedAt} to={run.endedAt} />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function Quick({
  href,
  icon,
  title,
  text,
}: {
  readonly href: string;
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly text: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-2xl border border-dashed p-4 transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
    </Link>
  );
}

function Quiet({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
  );
}

// The runs started in the last day, newest first, up to 200.
function lastDay(): Promise<Read<Page<InstanceSummary>>> {
  const startedFrom = new Date(Date.now() - DAY_MS).toISOString();
  return instances({ startedFrom, limit: 200 });
}

function countByPhase(runs: readonly InstanceSummary[]): Map<Phase, number> {
  const counts = new Map<Phase, number>();

  for (const run of runs)
    counts.set(run.phase, (counts.get(run.phase) ?? 0) + 1);

  return counts;
}
