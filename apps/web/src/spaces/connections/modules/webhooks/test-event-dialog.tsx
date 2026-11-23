"use client";

import { RefreshCwIcon, SendIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Problem } from "@/libs/data-access/problem";
import type { CloudEvent } from "@/libs/data-access/types";
import type { JsonValue } from "@/libs/json/json";
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
} from "@/libs/ui/components/field";
import { Input } from "@/libs/ui/components/input";
import { Spinner } from "@/libs/ui/components/spinner";
import { Textarea } from "@/libs/ui/components/textarea";
import { Disclosure } from "@/libs/ui/composites/disclosure";
import { ProblemMessage } from "@/libs/ui/composites/problem-message";
import { useAddressState } from "@/libs/routing/address-state";
import { FLAG } from "@/libs/routing/flag";
import { sendEventAction } from "./actions";
import { EventTypePicker } from "./event-type-picker";

interface TestEventDialogProps {
  readonly eventTypes: readonly string[];
}

const EXAMPLE_TYPE = "com.example.order.paid";
const EXAMPLE_DATA = '{\n  "orderId": 1,\n  "total": 42\n}';
const TEST = "test";
const NOT_JSON = "This is not JSON; check its quotes, commas and brackets.";

function dataOf(text: string): JsonValue | undefined {
  return text.trim() === "" ? undefined : (JSON.parse(text) as JsonValue);
}

export function TestEventDialog({ eventTypes }: TestEventDialogProps) {
  const firstType = eventTypes.at(0) ?? EXAMPLE_TYPE;
  const address = useAddressState();
  const open = address.flagged(TEST);
  const [id, setId] = useState(() => crypto.randomUUID());
  const [type, setType] = useState(firstType);
  const [source, setSource] = useState("/console");
  const [subject, setSubject] = useState("");
  const [data, setData] = useState(EXAMPLE_DATA);
  const [dataError, setDataError] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, start] = useTransition();
  const typeField = useRef<HTMLButtonElement>(null);
  const dataInvalid = dataError !== null;

  function send(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    let parsed: JsonValue | undefined;

    try {
      parsed = dataOf(data);
    } catch {
      setDataError(NOT_JSON);
      return;
    }

    const time = new Date().toISOString();
    const subjectPart = subject === "" ? {} : { subject };
    const dataPart =
      parsed === undefined
        ? {}
        : { datacontenttype: "application/json", data: parsed };
    const cloudEvent: CloudEvent = {
      specversion: "1.0",
      id,
      source,
      type,
      time,
      ...subjectPart,
      ...dataPart,
    };
    setProblem(null);
    start(async () => {
      const outcome = await sendEventAction(cloudEvent);

      if (!outcome.ok) {
        setProblem(outcome.problem);
        return;
      }

      const sent = `Test event ${type} sent`;
      toast.success(sent, {
        description: "What it started or resumed shows on Runs.",
      });
      setId(crypto.randomUUID());
      setOpen(false);
    });
  }

  function setOpen(next: boolean) {
    const flag = next ? FLAG : null;
    address.change({ [TEST]: flag });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <SendIcon data-icon="inline-start" />
          Send a test event
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          typeField.current?.focus();
        }}
      >
        <form onSubmit={send} className="flex min-w-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Send a test event</DialogTitle>
            <DialogDescription>
              As another app would send it: workflows that start on its type
              start, steps waiting for it go on, and notifications that match
              get it.
            </DialogDescription>
          </DialogHeader>
          <ProblemMessage problem={problem} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="event-type">Event type</FieldLabel>
              <FieldDescription>
                Pick one of your webhooks&apos; types, or type another.
              </FieldDescription>
              <EventTypePicker
                ref={typeField}
                id="event-type"
                value={type}
                known={eventTypes}
                onChange={setType}
              />
            </Field>
            <Field data-invalid={dataInvalid}>
              <FieldLabel htmlFor="event-data">
                Data{" "}
                <span className="font-normal text-muted-foreground">
                  optional
                </span>
              </FieldLabel>
              {dataError === null && (
                <FieldDescription>
                  JSON; leave it empty for an event without data.
                </FieldDescription>
              )}
              <Textarea
                id="event-data"
                value={data}
                onChange={(change) => {
                  setData(change.target.value);
                  setDataError(null);
                }}
                rows={6}
                spellCheck={false}
                aria-invalid={dataInvalid}
                className="font-mono"
              />
              {dataError !== null && <FieldError>{dataError}</FieldError>}
            </Field>
            <Disclosure title="More options" summary="Source, subject and id">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="event-source">Source</FieldLabel>
                  <Input
                    id="event-source"
                    value={source}
                    onChange={(change) => {
                      setSource(change.target.value);
                    }}
                    required
                    className="font-mono"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="event-subject">
                    Subject{" "}
                    <span className="font-normal text-muted-foreground">
                      optional
                    </span>
                  </FieldLabel>
                  <Input
                    id="event-subject"
                    value={subject}
                    onChange={(change) => {
                      setSubject(change.target.value);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="event-id">Id</FieldLabel>
                  <FieldDescription>
                    The same source and id are one event: sending it again has
                    no effect.
                  </FieldDescription>
                  <div className="flex gap-2">
                    <Input
                      id="event-id"
                      value={id}
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="New id"
                      onClick={() => {
                        setId(crypto.randomUUID());
                      }}
                    >
                      <RefreshCwIcon />
                    </Button>
                  </div>
                </Field>
              </FieldGroup>
            </Disclosure>
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
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SendIcon data-icon="inline-start" />
              )}
              Send event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
