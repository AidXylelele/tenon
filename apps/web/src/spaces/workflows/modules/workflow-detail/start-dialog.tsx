"use client";

import { PlayIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Problem } from "@/libs/data-access/problem";
import type { InputSchema } from "@/libs/data-access/types";
import { FieldControl } from "@/libs/forms/field-control";
import type { JsonObject, JsonValue } from "@/libs/json/json";
import { Button } from "@/libs/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/libs/ui/components/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/libs/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/libs/ui/components/select";
import { Spinner } from "@/libs/ui/components/spinner";
import { Textarea } from "@/libs/ui/components/textarea";
import { ProblemMessage } from "@/libs/ui/composites/problem-message";
import { runHref } from "@/libs/routing/routes";
import { startAction } from "./actions";
import {
  inputAfter,
  inputFieldsOf,
  refusalsOf,
  unplacedOf,
} from "./input-form";

interface StartDialogProps {
  readonly namespace: string;
  readonly name: string;
  readonly versions: readonly string[];
  readonly currentVersion: string;
  readonly inputSchema: InputSchema | null;
  readonly defaultOpen?: boolean;
}

const LATEST = "latest";
const NO_INPUT: JsonObject = {};

export function StartDialog({
  namespace,
  name,
  versions,
  currentVersion,
  inputSchema,
  defaultOpen = false,
}: StartDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [version, setVersion] = useState(LATEST);
  const [json, setJson] = useState("{}");
  const [formed, setFormed] = useState(NO_INPUT);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, start] = useTransition();
  const keys = useRef(new Map<string, string>());
  const current = version === LATEST || version === currentVersion;
  const refusals = refusalsOf(problem);
  const fields = current ? inputFieldsOf(inputSchema, formed, refusals) : null;
  const unplaced = problem === null ? null : unplacedOf(problem, fields);

  function inputOf(): JsonValue | undefined {
    if (fields !== null) return formed;

    try {
      return JSON.parse(json) as JsonValue;
    } catch {
      setJsonError("This is not JSON; check its quotes, commas and brackets.");
      return undefined;
    }
  }

  function keyFor(fingerprint: string): string {
    const known = keys.current.get(fingerprint);

    if (known !== undefined) return known;

    const key = crypto.randomUUID();
    keys.current.set(fingerprint, key);
    return key;
  }

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = inputOf();

    if (input === undefined) return;

    const fingerprint = JSON.stringify([version, input]);
    const key = keyFor(fingerprint);
    setProblem(null);
    start(async () => {
      const outcome = await startAction(namespace, name, version, input, key);

      if (!outcome.ok) {
        setProblem(outcome.problem);
        return;
      }

      keys.current.clear();
      toast.success(`Started ${name}`, {
        description: "Following the run live.",
      });
      router.push(runHref(outcome.value.id));
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);

        if (!next) keys.current.clear();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlayIcon data-icon="inline-start" />
          Start
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Start {name}</DialogTitle>
            <DialogDescription>
              The run gets this input as its data. You follow it live on its
              page.
            </DialogDescription>
          </DialogHeader>
          <ProblemMessage problem={unplaced} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="start-version">Version</FieldLabel>
              <Select value={version} onValueChange={setVersion}>
                <SelectTrigger id="start-version" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={LATEST}>The current version</SelectItem>
                  {versions.map((each) => (
                    <SelectItem key={each} value={each}>
                      {each}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {fields !== null ? (
              <FieldSet className="gap-4">
                <FieldLegend>Input</FieldLegend>
                {fields.map((field) => (
                  <FieldControl
                    key={field.pointer}
                    field={field}
                    onEdit={(action) => {
                      setFormed((before) => inputAfter(before, action));
                    }}
                  />
                ))}
              </FieldSet>
            ) : (
              <Field data-invalid={jsonError !== null}>
                <FieldLabel htmlFor="start-input">Input</FieldLabel>
                <Textarea
                  id="start-input"
                  value={json}
                  onChange={(event) => {
                    setJson(event.target.value);
                    setJsonError(null);
                  }}
                  rows={8}
                  spellCheck={false}
                  className="font-mono text-xs"
                  aria-invalid={jsonError !== null}
                />
                {jsonError === null ? (
                  <FieldDescription>
                    Any JSON value, for example{" "}
                    {'{ "email": "ada@example.com" }'}.
                  </FieldDescription>
                ) : (
                  <FieldError>{jsonError}</FieldError>
                )}
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {pending ? "Starting…" : "Start run"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
