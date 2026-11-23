"use client";

import { CircleXIcon, SendIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver-protocol";
import { codeOf, type Problem } from "@/libs/data-access/problem";
import type { Version } from "@/libs/data-access/types";
import { workflowHref } from "@/libs/routing/routes";
import { Button } from "@/libs/ui/components/button";
import { Spinner } from "@/libs/ui/components/spinner";
import { Status, type StatusLook } from "@/libs/ui/composites/status";
import type { WorkflowSession } from "@/operations/workflow-language";
import type { Publication } from "./interfaces";
import { freeVersion } from "./version";

const TAKEN = "workflow.version-taken";

interface PublishBarProps {
  readonly session: WorkflowSession;
  readonly problems: number;
  readonly onPlatformProblems: (problems: readonly Diagnostic[]) => void;
  readonly publish: () => Promise<Publication>;
  readonly onPublished: (version: Version) => Promise<void>;
  readonly currentVersion: string | null;
  readonly onUseVersion: (version: string) => void;
  readonly onShowProblems: () => void;
}

export function PublishBar({
  session,
  problems,
  onPlatformProblems,
  publish,
  onPublished,
  currentVersion,
  onUseVersion,
  onShowProblems,
}: PublishBarProps) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<StatusLook | null>(null);
  const [offered, setOffered] = useState<string | null>(null);
  const [publishing, startPublishing] = useTransition();
  const busy = publishing;

  async function documentOrRefusal(): Promise<unknown> {
    const read = await session.document();

    if (read.kind === "document") return read.document;

    const count = read.diagnostics.length;
    const label =
      count === 1
        ? "Fix the problem first"
        : `Fix the ${String(count)} problems first`;
    setOutcome({ tone: "warning", icon: TriangleAlertIcon, label });
    return null;
  }

  async function refuse(problem: Problem) {
    const pointers = problem.errors.map((error) => error.pointer);
    const placed = await session.rangesOf(pointers);
    const located = problem.errors.map((error, index) => {
      const pointed = placed.ranges[index] ?? null;
      const range =
        error.line === null ? pointed : rangeAt(error.line, error.column);
      return platformProblemOf(error.detail, range, error.pointer);
    });
    onPlatformProblems(located);
    setOutcome({ tone: "danger", icon: CircleXIcon, label: problem.detail });
  }

  function publishDraft() {
    if (problems > 0) {
      onShowProblems();
      return;
    }

    setOutcome(null);
    setOffered(null);
    startPublishing(async () => {
      const document = await documentOrRefusal();

      if (document === null) return;

      const publication = await publish();

      if (publication.kind === "held") return;

      if (publication.kind === "refused") {
        const taken = codeOf(publication.problem) === TAKEN;
        const free = taken ? freeVersion(document, currentVersion) : null;
        setOffered(free);
        await refuse(publication.problem);
        return;
      }

      const version = publication.version;
      const startPage = workflowHref(version.namespace, version.name, {
        start: true,
      });
      toast.success(`Version ${version.version} published`, {
        action: {
          label: "Start a run",
          onClick: () => {
            router.push(startPage);
          },
        },
      });
      await onPublished(version);
      const page = workflowHref(version.namespace, version.name);
      router.push(page);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span aria-live="polite" className="text-sm">
        {busy && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Spinner />
            Publishing…
          </span>
        )}
        {!busy && outcome !== null && <Status look={outcome} />}
      </span>
      {!busy && offered !== null && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onUseVersion(offered);
            setOffered(null);
            setOutcome(null);
          }}
        >
          Use version {offered}
        </Button>
      )}
      <Button disabled={busy} onClick={publishDraft}>
        <SendIcon data-icon="inline-start" />
        Publish
      </Button>
    </div>
  );
}

function rangeAt(line: number, column: number | null): Diagnostic["range"] {
  const start = { line: line - 1, character: (column ?? 1) - 1 };
  return { start, end: start };
}

function platformProblemOf(
  detail: string,
  range: Diagnostic["range"] | null,
  pointer: string,
): Diagnostic {
  const start = { line: 0, character: 0 };
  return {
    range: range ?? { start, end: start },
    severity: DiagnosticSeverity.Error,
    source: "platform",
    message: detail,
    data: { pointer },
  };
}
