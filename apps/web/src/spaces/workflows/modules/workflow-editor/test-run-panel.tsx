"use client";

import {
  ChevronDownIcon,
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
import { AbsoluteTime } from "@/libs/ui/composites/absolute-time";
import { useAnnounce } from "@/libs/ui/composites/announcer";
import { JsonBlock } from "@/libs/ui/composites/json-block";
import { PanelHeader } from "@/libs/ui/composites/panel-header";
import { ProblemMessage } from "@/libs/ui/composites/problem-message";
import { isUnended, phaseLabel } from "@/operations/run-progress";
import { cn } from "@/libs/ui/tokens/cn";
import { TaskStatusOf } from "@/features/run-status";
import type { TestRun } from "./interfaces";
import {
  callsOf,
  durationOf,
  lastRecordOf,
  resultLineOf,
  type Stop,
  stopOf,
} from "./test-run";
import type { TestRunState } from "./use-test-run";

interface TestRunPanelProps {
  readonly state: TestRunState;
  readonly lost: boolean;
  readonly scheduled: boolean;
  readonly steps: readonly Step[];
  readonly onRun: (input: JsonValue) => void;
  readonly onAgain: () => void;
  readonly onReadAgain: () => void;
  readonly onBack: () => void;
}

type InputWay = "empty" | "typed";

const TITLE_ID = "test-run-title";

const SUBTITLE =
  "Nothing is published; the run is labelled “Test” and not counted";

const EMPTY_INPUT: JsonValue = {};

const NOT_JSON = 'Write the input as JSON, for example { "id": 7 }.';

interface Banner {
  readonly variant: "default" | "success" | "warning" | "destructive";
  readonly icon: typeof LoaderIcon;
  readonly title: string;
  readonly detail: string;
}

const OPEN_A_STEP = "Open a step to see what it received and returned.";

const LOST: Banner = {
  variant: "destructive",
  icon: CircleXIcon,
  title: "The test run's progress could not be read",
  detail: "It may still be running; Runs shows it as well.",
};

const RUNNING: Banner = {
  variant: "default",
  icon: LoaderIcon,
  title: "The test run is running…",
  detail: "The flow shows each step as it runs.",
};

export function TestRunPanel({
  state,
  lost,
  scheduled,
  steps,
  onRun,
  onAgain,
  onReadAgain,
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
          <>
            <TestResult
              test={state.test}
              steps={steps}
              lost={lost}
              onReadAgain={onReadAgain}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={onBack}>
                Back to the editor
              </Button>
              <Button onClick={onAgain}>
                <PlayIcon data-icon="inline-start" />
                Test again
              </Button>
            </div>
          </>
        ) : (
          <TestStart
            state={state}
            scheduled={scheduled}
            steps={steps}
            onRun={onRun}
          />
        )}
      </div>
    </section>
  );
}

function TestStart({
  state,
  scheduled,
  steps,
  onRun,
}: {
  readonly state: TestRunState;
  readonly scheduled: boolean;
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
      {scheduled ? (
        <p className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Run with</span>
          Empty: this workflow starts on a schedule.
        </p>
      ) : (
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
      )}
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
  lost,
  onReadAgain,
}: {
  readonly test: TestRun;
  readonly steps: readonly Step[];
  readonly lost: boolean;
  readonly onReadAgain: () => void;
}) {
  const announce = useAnnounce();
  const running = isUnended(test.run.phase);
  const stop = running ? null : stopOf(test.records, steps);
  const banner = bannerOf(test, stop, lost);
  const Icon = banner.icon;

  useEffect(() => {
    if (!running) announce(banner.title);
  }, [announce, running, banner.title]);

  return (
    <>
      <Alert variant={banner.variant}>
        <Icon />
        <AlertTitle>{banner.title}</AlertTitle>
        <AlertDescription>
          {banner.detail}
          {lost && (
            <Button variant="outline" size="sm" onClick={onReadAgain}>
              Read it again
            </Button>
          )}
        </AlertDescription>
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
  const line = record === null ? null : resultLineOf(step, record);
  const duration =
    record === null ? null : durationOf(record.startedAt, record.endedAt);

  return (
    <li className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        disabled={record === null}
        className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 px-3 py-2 text-left disabled:cursor-default"
        onClick={() => {
          setOpen(!open);
        }}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-3">
            <span className="font-semibold">{step.name}</span>
            {record === null ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <CircleDashedIcon aria-hidden className="size-4" />
                Not reached
              </span>
            ) : (
              <TaskStatusOf status={record.status} />
            )}
          </span>
          {record !== null && (
            <span className="truncate text-caption text-muted-foreground">
              {line} · <AbsoluteTime value={record.startedAt} seconds />
            </span>
          )}
        </span>
        <span className="text-caption text-muted-foreground tabular-nums">
          {duration ?? "—"}
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open && "rotate-180",
            record === null && "invisible",
          )}
        />
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

function bannerOf(test: TestRun, stop: Stop | null, lost: boolean): Banner {
  const phase = test.run.phase;

  if (lost) return LOST;

  if (isUnended(phase)) return RUNNING;

  if (phase !== "completed") {
    const title = `Test run ${phaseLabel(phase).toLowerCase()}`;
    const detail = stop?.detail ?? OPEN_A_STEP;
    return { variant: "destructive", icon: CircleXIcon, title, detail };
  }

  if (stop !== null)
    return { variant: "warning", icon: TriangleAlertIcon, ...stop };

  const took = durationOf(test.run.startedAt, test.run.endedAt);
  const title =
    took === null ? "Test run succeeded" : `Test run succeeded in ${took}`;
  const detail = `Every step ran; ${OPEN_A_STEP.toLowerCase()}`;
  return { variant: "success", icon: CircleCheckIcon, title, detail };
}

function jsonOf(text: string): JsonValue | undefined {
  try {
    const value: JsonValue = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}
