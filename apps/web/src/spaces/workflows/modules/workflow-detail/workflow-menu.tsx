"use client";

import {
  ArchiveIcon,
  DownloadIcon,
  EllipsisIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Problem } from "@/libs/data-access/problem";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/libs/ui/components/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
import { Spinner } from "@/libs/ui/components/spinner";
import { IconButton } from "@/libs/ui/composites/icon-button";
import { ProblemMessage } from "@/libs/ui/composites/problem-message";
import type { YamlFile } from "../../__shared_context/yaml-file";
import { archiveAction } from "./actions";
import { useAutomaticStarts } from "./use-automatic-starts";

interface WorkflowMenuProps {
  readonly namespace: string;
  readonly name: string;
  readonly on: boolean;
  readonly automatic: boolean;
  readonly author: boolean;
  readonly yaml: YamlFile | null;
}

export function WorkflowMenu({
  namespace,
  name,
  on,
  automatic,
  author,
  yaml,
}: WorkflowMenuProps) {
  const { shown, turn } = useAutomaticStarts(namespace, name, on);
  const [archiving, setArchiving] = useState(false);
  const turns = author && automatic;
  const TurnIcon = shown ? PauseIcon : PlayIcon;
  const turnLabel = shown
    ? "Turn off automatic starts"
    : "Turn on automatic starts";

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton label="More actions" icon={EllipsisIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {turns && (
            <DropdownMenuItem
              onSelect={() => {
                turn(!shown);
              }}
            >
              <TurnIcon aria-hidden />
              {turnLabel}
            </DropdownMenuItem>
          )}
          {yaml !== null && (
            <DropdownMenuItem asChild>
              <a href={yaml.href} download={yaml.name}>
                <DownloadIcon aria-hidden />
                Download YAML
              </a>
            </DropdownMenuItem>
          )}
          {author && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  setArchiving(true);
                }}
              >
                <ArchiveIcon aria-hidden />
                Archive…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ArchiveDialog
        namespace={namespace}
        name={name}
        open={archiving}
        onOpenChange={setArchiving}
      />
    </>
  );
}

function ArchiveDialog({
  namespace,
  name,
  open,
  onOpenChange,
}: {
  readonly namespace: string;
  readonly name: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [refusal, setRefusal] = useState<Problem | null>(null);
  const [pending, start] = useTransition();
  const title = `Archive ${name}?`;

  function change(next: boolean) {
    onOpenChange(next);

    if (!next) setRefusal(null);
  }

  function archive(event: React.MouseEvent) {
    event.preventDefault();
    start(async () => {
      const outcome = await archiveAction(namespace, name);

      if (!outcome.ok) {
        setRefusal(outcome.problem);
        return;
      }

      onOpenChange(false);
      toast.success(`${name} archived`);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={change}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            It starts no run and takes no version. Its versions and runs stay
            readable. Archiving cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ProblemMessage problem={refusal} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={archive}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ArchiveIcon data-icon="inline-start" />
            )}
            Archive workflow
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
