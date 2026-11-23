"use client";

import { useSyncExternalStore } from "react";
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
import { Time } from "@/libs/ui/composites/time";
import { DraftConflict } from "@/features/draft-conflict";
import type { DraftStore } from "./draft-store";
import type { DraftState } from "./interfaces";
import { useLeaveGuard } from "./use-leave-guard";

export function DraftLine({
  store,
  userId,
}: {
  readonly store: DraftStore;
  readonly userId: string;
}) {
  const draft = useDraftState(store);

  if (draft.conflict !== null) return "Someone else saved this draft";

  if (draft.status === "saving") return "Saving…";

  if (draft.status === "unsaved") return "Unsaved changes";

  if (draft.status === "failed")
    return (
      <span className="text-destructive">
        Not saved: {draft.failure}
        {draft.retrying && ". Retrying"}
      </span>
    );

  if (draft.saved === null) return "No changes yet";

  const by = draft.saved.by.id === userId ? "you" : draft.saved.by.name;
  return (
    <>
      Draft saved by {by} <Time value={draft.saved.at} />
    </>
  );
}

export function DraftGuard({ store }: { readonly store: DraftStore }) {
  const draft = useDraftState(store);
  const guard = useLeaveGuard(draft.status !== "clean");
  const holder = draft.conflict?.theirs.draft.savedBy.name ?? null;
  const loss =
    holder === null
      ? "The editor sends the latest changes as it closes; if that save fails, they are lost."
      : `${holder} saved this draft meanwhile; your changes are not saved and are lost if you leave. Resolve first.`;

  return (
    <AlertDialog
      open={guard.leaving !== null}
      onOpenChange={(open) => {
        if (!open) guard.stay();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave before the draft is saved?</AlertDialogTitle>
          <AlertDialogDescription>{loss}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={guard.leave}>
            Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DraftResolution({
  store,
  readMine,
}: {
  readonly store: DraftStore;
  readonly readMine: () => string;
}) {
  const conflict = useDraftState(store).conflict;

  if (conflict === null) return null;

  const theirs = conflict.theirs.draft;
  return (
    <DraftConflict
      savedBy={theirs.savedBy.name}
      savedAt={theirs.savedAt}
      theirs={theirs.source}
      base={conflict.base}
      readMine={readMine}
      onResolve={(text) => {
        store.resolve(text);
      }}
    />
  );
}

export function useDraftState(store: DraftStore): DraftState {
  return useSyncExternalStore(store.subscribe, store.read, store.read);
}
