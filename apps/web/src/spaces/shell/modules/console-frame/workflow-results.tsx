"use client";

import { WorkflowIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signInHref, WORKFLOW_SEARCH_HREF } from "@/libs/routing/routes";
import { CommandGroup, CommandItem } from "@/libs/ui/components/command";
import { Spinner } from "@/libs/ui/components/spinner";
import { type FoundWorkflow, FoundWorkflows } from "./found-workflow";

type Answer =
  | { readonly kind: "found"; readonly workflows: readonly FoundWorkflow[] }
  | { readonly kind: "failed" }
  | { readonly kind: "signed-out" };

export interface WorkflowSearch {
  readonly found: readonly FoundWorkflow[] | null;
  readonly failed: boolean;
  readonly reading: boolean;
  readonly read: () => void;
}

interface WorkflowResultsProps {
  readonly search: WorkflowSearch;
  readonly onChoose: (workflow: FoundWorkflow) => void;
}

const FAILED: Answer = { kind: "failed" };

export function useWorkflowSearch(): WorkflowSearch {
  const router = useRouter();
  const [found, setFound] = useState<readonly FoundWorkflow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reading, startReading] = useTransition();

  function read() {
    startReading(async () => {
      const answer = await askForWorkflows();

      if (answer.kind === "signed-out") {
        const here = `${window.location.pathname}${window.location.search}`;
        const signIn = signInHref({ reason: "ended", next: here });
        router.push(signIn);
        return;
      }

      const workflows = answer.kind === "found" ? answer.workflows : [];
      setFailed(answer.kind === "failed");
      setFound(workflows);
    });
  }

  return { found, failed, reading, read };
}

async function askForWorkflows(): Promise<Answer> {
  try {
    const response = await fetch(WORKFLOW_SEARCH_HREF, { redirect: "manual" });

    if (response.type === "opaqueredirect") return { kind: "signed-out" };

    if (!response.ok) return FAILED;

    const body: unknown = await response.json();
    const parsed = FoundWorkflows.safeParse(body);

    if (!parsed.success) return FAILED;

    return { kind: "found", workflows: parsed.data };
  } catch {
    return FAILED;
  }
}

export function WorkflowResults({ search, onChoose }: WorkflowResultsProps) {
  return (
    <>
      {isFirstRead(search) && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground">
          <Spinner className="size-3.5" />
          Reading workflows…
        </div>
      )}
      {search.failed && (
        <p className="px-3 py-1.5 text-muted-foreground">
          Workflows could not be read.
        </p>
      )}
      <WorkflowGroup search={search} onChoose={onChoose} />
    </>
  );
}

export function isFirstRead(search: WorkflowSearch): boolean {
  return search.reading && search.found === null;
}

export function workflowValueOf(workflow: FoundWorkflow): string {
  return `${workflow.namespace} ${workflow.name}`;
}

function WorkflowGroup({ search, onChoose }: WorkflowResultsProps) {
  return (
    <CommandGroup heading="Workflows">
      {search.found?.map((each) => {
        const value = workflowValueOf(each);
        return (
          <CommandItem
            key={value}
            value={value}
            onSelect={() => {
              onChoose(each);
            }}
          >
            <WorkflowIcon />
            <span>{each.name}</span>
            <span className="text-muted-foreground">{each.namespace}</span>
            {each.archived && (
              <span className="ml-auto text-caption text-muted-foreground">
                Archived
              </span>
            )}
            {each.on && (
              <span className="ml-auto text-caption text-muted-foreground">
                On
              </span>
            )}
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}
