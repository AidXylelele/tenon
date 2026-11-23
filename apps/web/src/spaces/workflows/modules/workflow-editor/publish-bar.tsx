"use client";

import { CircleXIcon, SendIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver-protocol";
import { codeOf, type Outcome, type Problem } from "@/libs/data-access/problem";
import type { Version } from "@/libs/data-access/types";
import { workflowHref } from "@/libs/routing/routes";
import { Button } from "@/libs/ui/components/button";
import { Spinner } from "@/libs/ui/components/spinner";
import { Status, type StatusLook } from "@/libs/ui/composites/status";
import type { WorkflowSession } from "@/operations/workflow-language";
import type { ChangeReading, PublishChoice, Publication } from "./interfaces";
import { PublishDialog } from "./publish-dialog";
import { freeVersion, writtenVersionOf } from "./version";

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
  readonly title: string;
  readonly startsByItself: boolean;
  readonly tested: boolean;
  readonly ready: boolean;
  readonly onTest: () => void;
  readonly changesOf: () => Promise<ChangeReading>;
  readonly setVersion: (version: string) => Promise<void>;
  readonly turnOn: () => Promise<Outcome<void>>;
}

interface OpenDialog {
  readonly draftVersion: string;
  readonly changes: ChangeReading;
}

const FIRST_VERSION = "1.0.0";

const READING: ChangeReading = { kind: "reading" };

const NO_CHANGES: ChangeReading = { kind: "read", changes: [] };

export function PublishBar({
  session,
  problems,
  onPlatformProblems,
  publish,
  onPublished,
  currentVersion,
  onUseVersion,
  onShowProblems,
  title,
  startsByItself,
  tested,
  ready,
  onTest,
  changesOf,
  setVersion,
  turnOn,
}: PublishBarProps) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<StatusLook | null>(null);
  const [offered, setOffered] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [opening, startOpening] = useTransition();
  const [publishing, startPublishing] = useTransition();
  const busy = publishing || opening;

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

  function openDialog() {
    if (problems > 0) {
      onShowProblems();
      return;
    }

    setOutcome(null);
    startOpening(async () => {
      const document = await documentOrRefusal();

      if (document === null) return;

      const draftVersion = writtenVersionOf(document) ?? FIRST_VERSION;
      setDialog({ draftVersion, changes: READING });
      const changes = currentVersion === null ? NO_CHANGES : await changesOf();
      setDialog((shown) => (shown === null ? null : { ...shown, changes }));
    });
  }

  function publishDraft(choice: PublishChoice) {
    const draftVersion = dialog?.draftVersion ?? null;
    setDialog(null);
    setOffered(null);
    startPublishing(async () => {
      if (choice.version !== draftVersion) await setVersion(choice.version);

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
      const turned = choice.turnOn ? await turnOn() : null;
      const told = turned?.ok === true ? " · Turned on" : "";
      const startPage = workflowHref(version.namespace, version.name, {
        start: true,
      });
      toast.success(`Version ${version.version} published${told}`, {
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
            {publishing ? "Publishing…" : "Reading the draft…"}
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
      <Button
        variant={ready ? "default" : "outline"}
        disabled={busy}
        onClick={openDialog}
      >
        <SendIcon data-icon="inline-start" />
        Publish
      </Button>
      {dialog !== null && (
        <PublishDialog
          open
          title={title}
          currentVersion={currentVersion}
          draftVersion={dialog.draftVersion}
          changes={dialog.changes}
          startsByItself={startsByItself}
          tested={tested}
          onTest={() => {
            setDialog(null);
            onTest();
          }}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          onPublish={publishDraft}
        />
      )}
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
