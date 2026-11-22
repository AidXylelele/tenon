"use client";

import { yaml } from "@codemirror/lang-yaml";
import { getChunks, unifiedMergeView } from "@codemirror/merge";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { TriangleAlertIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { CodeMirrorView } from "@/libs/codemirror/codemirror-view";
import { tokenTheme } from "@/libs/codemirror/theme";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/libs/ui/components/alert-dialog";
import { Button } from "@/libs/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/libs/ui/components/dialog";
import { Time } from "@/libs/ui/composites/time";
import { mergedDrafts } from "@/operations/draft-merge";
import type { DraftConflictProps, Resolution } from "./interfaces";

const UNCHANGED = { margin: 2, minSize: 4 };

export function DraftConflict({
  savedBy,
  savedAt,
  theirs,
  base,
  readMine,
  onResolve,
}: DraftConflictProps) {
  const [resolution, setResolution] = useState<Resolution | null>(null);

  function open() {
    const mine = readMine();
    const merge = base === null ? null : mergedDrafts(base, mine, theirs);
    const merged = merge?.kind === "clean" ? merge.text : null;
    setResolution({ mine, merged });
  }

  function resolve(text: string) {
    setResolution(null);
    onResolve(text);
  }

  return (
    <>
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 border-b bg-warning-soft px-4 py-2 text-sm"
      >
        <TriangleAlertIcon className="size-4 text-warning" aria-hidden />
        <span className="min-w-0 flex-1">
          {savedBy} saved this draft <Time value={savedAt} /> while you edited
          it. Your changes wait here until you choose.
        </span>
        <Button size="sm" onClick={open}>
          Resolve
        </Button>
      </div>
      {resolution !== null && (
        <Resolve
          savedBy={savedBy}
          theirs={theirs}
          resolution={resolution}
          onResolve={resolve}
          onClose={() => {
            setResolution(null);
          }}
        />
      )}
    </>
  );
}

function Resolve({
  savedBy,
  theirs,
  resolution,
  onResolve,
  onClose,
}: {
  readonly savedBy: string;
  readonly theirs: string;
  readonly resolution: Resolution;
  readonly onResolve: (text: string) => void;
  readonly onClose: () => void;
}) {
  const pane = useRef<EditorView | null>(null);
  const extensions = useMemo<Extension>(
    () => [
      yaml(),
      tokenTheme(),
      unifiedMergeView({
        original: theirs,
        mergeControls: true,
        collapseUnchanged: UNCHANGED,
      }),
    ],
    [theirs],
  );
  const merged = resolution.merged;
  const [undecided, setUndecided] = useState<number | null>(null);

  function saveMerged() {
    const view = pane.current;

    if (view === null) return;

    const open = getChunks(view.state)?.chunks.length ?? 0;

    if (merged === null && open > 0) {
      setUndecided(open);
      return;
    }

    onResolve(view.state.doc.toString());
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Your text against {savedBy}&apos;s</DialogTitle>
          <DialogDescription>
            Lines only in theirs show as removed and lines only in yours as
            added. Accept or reject each change, then save the merge; a change
            left undecided keeps the text shown here.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50svh] min-h-40 overflow-auto rounded-lg border">
          <CodeMirrorView
            doc={merged ?? resolution.mine}
            extensions={extensions}
            label="Your text against theirs"
            onView={(view) => {
              pane.current = view;
            }}
          />
        </div>
        <DialogFooter className="flex-wrap">
          <LosingChoice
            label="Use theirs"
            lost="Your changes since your last save are lost."
            onConfirm={() => {
              onResolve(theirs);
            }}
          />
          <LosingChoice
            label="Keep mine"
            lost={`${savedBy}'s changes since your last save are lost.`}
            onConfirm={() => {
              onResolve(resolution.mine);
            }}
          />
          {merged !== null && (
            <Button
              variant="outline"
              onClick={() => {
                onResolve(merged);
              }}
            >
              Keep both
            </Button>
          )}
          <Button onClick={saveMerged}>Save merged</Button>
        </DialogFooter>
        <AlertDialog
          open={undecided !== null}
          onOpenChange={(open) => {
            if (!open) setUndecided(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Save with changes undecided?</AlertDialogTitle>
              <AlertDialogDescription>
                {savedBy}&apos;s side of {undecidedText(undecided ?? 0)} is
                lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  const text = pane.current?.state.doc.toString();

                  if (text !== undefined) onResolve(text);
                }}
              >
                Save merged
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

function LosingChoice({
  label,
  lost,
  onConfirm,
}: {
  readonly label: string;
  readonly lost: string;
  readonly onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">{label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>{lost}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function undecidedText(count: number): string {
  return count === 1
    ? "the change you did not decide"
    : `the ${String(count)} changes you did not decide`;
}
