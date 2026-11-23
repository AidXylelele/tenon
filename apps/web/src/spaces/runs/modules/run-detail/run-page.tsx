import type { WorkflowStructure } from "language-server/protocol";
import type {
  CloudEvent,
  Instance,
  Page,
  Read,
  TaskRecord,
} from "@/libs/data-access/types";
import { LiveUpdates } from "@/libs/live/live-updates";
import { PencilIcon } from "lucide-react";
import { Link } from "@/libs/routing/link";
import { editorHref } from "@/libs/routing/routes";
import { Button } from "@/libs/ui/components/button";
import { isUnended } from "@/operations/run-progress";
import { PhaseStatus } from "@/features/run-status";
import { ViewerLine } from "@/features/viewer-notice";
import { Controls } from "./controls";
import type { RunPanel } from "./query";
import { RunFacts } from "./run-facts";
import { RunView } from "./run-view";

export interface RunPageProps {
  readonly instance: Instance;
  readonly workflow: WorkflowStructure | null;
  readonly records: Read<Page<TaskRecord>>;
  readonly panel: RunPanel;
  readonly events: readonly CloudEvent[] | null;
  readonly author: boolean;
  readonly operator: boolean;
}

export function RunPage({
  instance,
  workflow,
  records,
  panel,
  events,
  author,
  operator,
}: RunPageProps) {
  const live = isUnended(instance.phase);
  const activity = live ? "in-flight" : "ended";
  const more = records.next !== null;
  const editor = editorHref(instance.namespace, instance.name);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 border-b px-4 py-3 md:px-6">
        <div className="min-w-60 flex-1">
          <h1 className="heading-1 flex flex-wrap items-center gap-3">
            Run of {instance.name}
            <PhaseStatus phase={instance.phase} />
          </h1>
          <RunFacts instance={instance} />
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {author && (
            <Button variant="outline" asChild>
              <Link href={editor}>
                <PencilIcon data-icon="inline-start" />
                Edit
              </Link>
            </Button>
          )}
          {operator ? (
            <Controls id={instance.id} controls={instance.controls} />
          ) : (
            <ViewerLine />
          )}
        </div>
      </div>
      <LiveUpdates activity={activity} />
      <RunView
        instance={instance}
        workflow={workflow}
        records={records.items}
        more={more}
        panel={panel}
        events={events}
        canEdit={author}
      />
    </div>
  );
}
