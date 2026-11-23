"use client";

import { SendIcon, TriangleAlertIcon } from "lucide-react";
import { useId, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/libs/ui/components/alert";
import { Button } from "@/libs/ui/components/button";
import { Checkbox } from "@/libs/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/libs/ui/components/dialog";
import { Label } from "@/libs/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/libs/ui/components/radio-group";
import type { PublishChoice, StepChange, VersionChoice } from "./interfaces";
import { versionChoicesOf } from "./version";

interface PublishDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly currentVersion: string | null;
  readonly draftVersion: string;
  readonly changes: readonly StepChange[] | null;
  readonly startsByItself: boolean;
  readonly tested: boolean;
  readonly onTest: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPublish: (choice: PublishChoice) => void;
}

const CHANGE_WORDS: Readonly<Record<StepChange["kind"], string>> = {
  added: "added",
  changed: "changed",
  removed: "removed",
};

const FIRST_LINE = "The first version; runs use it from now on.";

const LATER_LINE =
  "Runs that start after this use the new version; runs in progress keep theirs.";

export function PublishDialog({
  open,
  title,
  currentVersion,
  draftVersion,
  changes,
  startsByItself,
  tested,
  onTest,
  onOpenChange,
  onPublish,
}: PublishDialogProps) {
  const id = useId();
  const turnOnId = `${id}-turn-on`;
  const choices =
    currentVersion === null ? [] : versionChoicesOf(currentVersion);
  const [first] = choices;
  const [version, setVersion] = useState(first?.version ?? draftVersion);
  const [turnOn, setTurnOn] = useState(true);
  const isFirst = currentVersion === null;
  const turning = startsByItself && turnOn;
  const actionWords = turning
    ? `Publish ${version} and turn on`
    : `Publish ${version}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish “{title}”</DialogTitle>
          <DialogDescription>
            {isFirst ? FIRST_LINE : LATER_LINE}
          </DialogDescription>
        </DialogHeader>
        {!tested && (
          <Alert variant="warning">
            <TriangleAlertIcon />
            <AlertTitle>Not tested since your last change</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              You can publish anyway.
              <Button variant="outline" size="sm" onClick={onTest}>
                Run a test first
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {!isFirst && <ChangeList changes={changes} />}
        {isFirst ? (
          <p className="flex flex-col gap-1">
            <span className="font-semibold">Version</span>
            <span className="tabular-nums">{version}</span>
          </p>
        ) : (
          <VersionChoices
            choices={choices}
            version={version}
            onVersion={setVersion}
          />
        )}
        {startsByItself ? (
          <div className="flex items-start gap-2">
            <Checkbox
              id={turnOnId}
              checked={turnOn}
              className="mt-0.5"
              onCheckedChange={(checked) => {
                setTurnOn(checked === true);
              }}
            />
            <Label htmlFor={turnOnId}>Turn on automatic starts</Label>
          </div>
        ) : (
          <p className="text-caption text-muted-foreground">
            It starts by hand or when another app starts it; there is nothing to
            turn on.
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onPublish({ version, turnOn: turning });
            }}
          >
            <SendIcon data-icon="inline-start" />
            {actionWords}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeList({
  changes,
}: {
  readonly changes: readonly StepChange[] | null;
}) {
  const id = useId();

  if (changes === null)
    return (
      <p role="status" className="text-caption text-muted-foreground">
        Reading what changed…
      </p>
    );

  return (
    <div className="flex flex-col gap-1">
      <h3 id={id} className="font-semibold">
        What changed
      </h3>
      {changes.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          No step was added, changed or removed.
        </p>
      ) : (
        <ul aria-labelledby={id} className="list-disc pl-5">
          {changes.map((change) => (
            <li key={`${change.kind}:${change.name}`}>
              {change.name} — {CHANGE_WORDS[change.kind]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VersionChoices({
  choices,
  version,
  onVersion,
}: {
  readonly choices: readonly VersionChoice[];
  readonly version: string;
  readonly onVersion: (version: string) => void;
}) {
  const id = useId();

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold">Version</legend>
      <RadioGroup value={version} onValueChange={onVersion}>
        {choices.map((choice) => {
          const itemId = `${id}-${choice.kind}`;
          return (
            <div key={choice.kind} className="flex items-center gap-2">
              <RadioGroupItem id={itemId} value={choice.version} />
              <Label htmlFor={itemId} className="font-normal">
                {choice.words}
                <span className="font-mono text-muted-foreground">
                  {choice.version}
                </span>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}
