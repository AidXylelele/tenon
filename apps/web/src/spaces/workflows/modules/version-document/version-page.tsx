import { PencilIcon } from "lucide-react";
import type {
  Version,
  VersionStructure,
  Workflow,
} from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { editorHref } from "@/libs/routing/routes";
import { Badge } from "@/libs/ui/components/badge";
import { Button } from "@/libs/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/libs/ui/components/tooltip";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { AbsoluteTime } from "@/libs/ui/composites/absolute-time";
import { SourceView } from "@/features/code-editor";
import { WorkflowFlow } from "@/features/workflow-flow";
import { StartDialog } from "../../__shared_context/start-dialog";
import { type VersionSource, VersionMenu } from "./version-menu";
import { ViewChoice, type VersionView } from "./view-choice";

export interface VersionPageProps {
  readonly workflow: Workflow;
  readonly version: string;
  readonly versions: readonly Version[];
  readonly structure: VersionStructure | null;
  readonly file: VersionSource;
  readonly download: string;
  readonly view: VersionView;
  readonly hrefs: Readonly<Record<VersionView, string>>;
  readonly author: boolean;
  readonly operator: boolean;
}

const READ = { kind: "read" } as const;

const EDITS_THE_DRAFT = "Edit the draft of this workflow";

export function VersionPage({
  workflow,
  version,
  versions,
  structure,
  file,
  download,
  view,
  hrefs,
  author,
  operator,
}: VersionPageProps) {
  const namespace = workflow.namespace;
  const name = workflow.name;
  const current = workflow.currentVersion;
  const archived = workflow.status === "archived";
  const facts = versions.find((each) => each.version === version);
  const title = `Version ${version}`;
  const workflowTitle = structure?.title ?? name;
  const versionNames = versions.map((each) => each.version);
  const isCurrent = facts?.current === true;
  const inputSchema = isCurrent ? (structure?.input.schema ?? null) : null;
  const editor = editorHref(namespace, name);
  const flowShown = view === "flow" && structure !== null;
  const sourceLabel = `${file.kind} of version ${version}`;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {title}
            {isCurrent && <Badge>Current</Badge>}
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-1">
            {facts !== undefined && (
              <>
                <span>
                  Published by {facts.publishedBy.name}{" "}
                  <AbsoluteTime value={facts.publishedAt} /> ·
                </span>
                <span>{facts.runs} runs ·</span>
              </>
            )}
            <span className="font-mono">
              {namespace}/{name}
            </span>
          </span>
        }
        actions={
          <>
            {structure !== null && <ViewChoice view={view} hrefs={hrefs} />}
            {author && !archived && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" asChild>
                    <Link href={editor}>
                      <PencilIcon data-icon="inline-start" />
                      Edit
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{EDITS_THE_DRAFT}</TooltipContent>
              </Tooltip>
            )}
            {operator && !archived && current !== null && (
              <StartDialog
                namespace={namespace}
                name={name}
                title={workflowTitle}
                versions={versionNames}
                currentVersion={current}
                inputSchema={inputSchema}
                chosen={version}
                label="Run this version"
              />
            )}
            <VersionMenu file={file} download={download} />
          </>
        }
      />
      {flowShown ? (
        <div className="overflow-hidden rounded-lg border bg-canvas">
          <WorkflowFlow workflow={structure} mode={READ} />
        </div>
      ) : (
        <SourceView text={file.text} label={sourceLabel} />
      )}
    </>
  );
}
