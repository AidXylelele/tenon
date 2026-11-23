"use client";

import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  LoaderIcon,
  PlayIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { Step } from "language-server/protocol";
import { useEffect, useId, useState } from "react";
import type { TaskRecord } from "@/libs/data-access/types";
import type { JsonValue } from "@/libs/json/json";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/libs/ui/components/alert";
import { Button } from "@/libs/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
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
import { useAnnounce } from "@/libs/ui/composites/announcer";
import { JsonBlock } from "@/libs/ui/composites/json-block";
import { PanelHeader } from "@/libs/ui/composites/panel-header";
import { ProblemMessage } from "@/libs/ui/composites/problem-message";
import { isUnended, phaseLabel } from "@/operations/run-progress";
import { TaskStatusOf } from "@/features/run-status";
import type { TestRun } from "./interfaces";
import { callsOf, lastRecordOf } from "./test-run";
import type { TestRunState } from "./use-test-run";

interface TestRunPanelProps {
  readonly state: TestRunState;
  readonly steps: readonly Step[];
  readonly onRun: (input: JsonValue) => void;
  readonly onAgain: () => void;
  readonly onBack: () => void;
}

type InputWay = "empty" | "typed";

const TITLE_ID = "test-run-title";

const SUBTITLE =
  "Nothing is published; the run is labelled “Test” and not counted";

const EMPTY_INPUT: JsonValue = {};

const NOT_JSON = 'Write the input as JSON, for example { "id": 7 }.';

export function TestRunPanel({
  state,
  steps,
  onRun,
  onAgain,
  onBack,
}: TestRunPanelProps) {
  return (
    <section
      aria-labelledby={TITLE_ID}
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelHeader
        title="Test run of the draft"
        titleId={TITLE_ID}
        subtitle={SUBTITLE}
        onBack={onBack}
        backLabel="Back to the editor"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {state.kind === "ran" ? (
          <TestResult test={state.test} steps={steps} />
        ) : (
          <TestStart state={state} steps={steps} onRun={onRun} />
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onBack}>
            Back to the editor
          </Button>
          {state.kind === "ran" && (
            <Button onClick={onAgain}>
              <PlayIcon data-icon="inline-start" />
              Test again
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function TestStart({
  state,
  steps,
  onRun,
}: {
  readonly state: TestRunState;
  readonly steps: readonly Step[];
  readonly onRun: (input: JsonValue) => void;
}) {
  const id = useId();
  const typedId = `${id}-typed`;
  const errorId = `${id}-error`;
  const [way, setWay] = useState<InputWay>("empty");
  const [typed, setTyped] = useState("{}");
  const [refusal, setRefusal] = useState<string | null>(null);
  const calls = callsOf(steps);
  const starting = state.kind === "starting";
  const callWords =
    calls.length === 0
      ? "This workflow calls no service; the test runs its steps only."
      : `It will call: ${calls.join("; ")}.`;

  function run() {
    if (way === "empty") {
      onRun(EMPTY_INPUT);
      return;
    }

    const input = jsonOf(typed);

    if (input === undefined) {
      setRefusal(NOT_JSON);
      return;
    }

    setRefusal(null);
    onRun(input);
  }

  return (
    <>
      <Field>
        <FieldLabel htmlFor={id}>Run with</FieldLabel>
        <Select
          value={way}
          onValueChange={(chosen) => {
            setWay(chosen === "typed" ? "typed" : "empty");
          }}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="empty">
              An empty input (usual for a schedule)
            </SelectItem>
            <SelectItem value="typed">Input I type…</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {way === "typed" && (
        <Field data-invalid={refusal !== null}>
          <FieldLabel htmlFor={typedId}>The input, as JSON</FieldLabel>
          <Textarea
            id={typedId}
            rows={4}
            spellCheck={false}
            className="font-mono"
            value={typed}
            aria-invalid={refusal !== null}
            aria-describedby={refusal === null ? undefined : errorId}
            onChange={(event) => {
              setTyped(event.currentTarget.value);
            }}
          />
          {refusal !== null && <FieldError id={errorId}>{refusal}</FieldError>}
        </Field>
      )}
      <Alert variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>A test run really calls the services</AlertTitle>
        <AlertDescription>{callWords}</AlertDescription>
      </Alert>
      {state.kind === "refused" &&
        (state.problem === null ? (
          <Alert variant="destructive">
            <CircleXIcon />
            <AlertTitle>{state.reason}</AlertTitle>
          </Alert>
        ) : (
          <ProblemMessage problem={state.problem} />
        ))}
      <Button className="self-end" disabled={starting} onClick={run}>
        {starting ? <Spinner /> : <PlayIcon data-icon="inline-start" />}
        Run the test
      </Button>
    </>
  );
}

function TestResult({
  test,
  steps,
}: {
  readonly test: TestRun;
  readonly steps: readonly Step[];
}) {
  const announce = useAnnounce();
  const phase = test.run.phase;
  const running = isUnended(phase);
  const succeeded = phase === "completed";
  const variant = running ? "default" : succeeded ? "success" : "destructive";
  const Icon = running ? LoaderIcon : succeeded ? CircleCheckIcon : CircleXIcon;
  const title = running
    ? "The test run is running…"
    : `Test run ${phaseLabel(phase).toLowerCase()}`;
  const detail = running
    ? "The flow shows each step as it runs."
    : "Open a step to see what it received and returned.";

  useEffect(() => {
    if (!running) announce(title);
  }, [announce, running, title]);

  return (
    <>
      <Alert variant={variant}>
        <Icon />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{detail}</AlertDescription>
      </Alert>
      <ol className="flex flex-col divide-y rounded-lg border">
        {steps.map((step) => {
          const record = lastRecordOf(test.records, steps, step.id);
          return <StepResult key={step.id} step={step} record={record} />;
        })}
      </ol>
    </>
  );
}

function StepResult({
  step,
  record,
}: {
  readonly step: Step;
  readonly record: TaskRecord | null;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <li className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        disabled={record === null}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left disabled:cursor-default"
        onClick={() => {
          setOpen(!open);
        }}
      >
        <span className="font-semibold">{step.name}</span>
        {record === null ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CircleDashedIcon aria-hidden className="size-4" />
            Not reached
          </span>
        ) : (
          <TaskStatusOf status={record.status} />
        )}
      </button>
      {open && record !== null && (
        <div id={id} className="flex flex-col gap-3 px-3 pb-3">
          <Field>
            <FieldLabel>What it received</FieldLabel>
            <JsonBlock value={record.input} />
          </Field>
          <Field>
            <FieldLabel>What it returned</FieldLabel>
            <JsonBlock value={record.output} />
            {record.error !== null && (
              <FieldDescription>{record.error.title}</FieldDescription>
            )}
          </Field>
        </div>
      )}
    </li>
  );
}

function jsonOf(text: string): JsonValue | undefined {
  try {
    const value: JsonValue = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}
