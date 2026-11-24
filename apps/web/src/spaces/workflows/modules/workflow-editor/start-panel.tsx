"use client";

import { PlusIcon, SendIcon } from "lucide-react";
import type { WorkflowFormResult } from "language-server/protocol";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Link } from "@/libs/routing/link";
import { WEBHOOKS_HREF } from "@/libs/routing/routes";
import { Button } from "@/libs/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/libs/ui/components/field";
import { Spinner } from "@/libs/ui/components/spinner";
import { Switch } from "@/libs/ui/components/switch";
import { PanelHeader } from "@/libs/ui/composites/panel-header";
import { testEventAction, turnStartsAction } from "./actions";
import { startOf } from "./form-fields";
import type { Starts, WorkflowName } from "./interfaces";
import { type Edit, StartForm, type Webhook } from "./step-form";

interface StartPanelProps {
  readonly name: WorkflowName;
  readonly form: WorkflowFormResult | null;
  readonly formless: boolean;
  readonly webhooks: readonly Webhook[];
  readonly starts: Starts | null;
  readonly revealProblems: boolean;
  readonly languageTerms: boolean;
  readonly onEdit: Edit;
  readonly onClose: () => void;
}

const TITLE_ID = "start-panel-title";

const TEST_EVENT_SENT =
  "Test event sent; the run appears in the workflow's runs";

export function StartPanel({
  name,
  form,
  formless,
  webhooks,
  starts,
  revealProblems,
  languageTerms,
  onEdit,
  onClose,
}: StartPanelProps) {
  const [now] = useState(() => new Date().toISOString());
  const [zone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const schedule = form?.fields.find((field) => field.pointer === "/schedule");
  const types = webhooks.map((webhook) => webhook.eventType);
  const start = startOf(schedule, types);
  const startsByItself = start.way !== "hand";
  const eventType = start.eventType;
  const subtitle = languageTerms ? "schedule" : undefined;

  return (
    <section
      aria-labelledby={TITLE_ID}
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelHeader
        title="How the workflow starts"
        titleId={TITLE_ID}
        subtitle={subtitle}
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {form !== null && (
          <StartForm
            form={form}
            webhooks={webhooks}
            now={now}
            zone={zone}
            revealProblems={revealProblems}
            languageTerms={languageTerms}
            onEdit={onEdit}
          />
        )}
        {form === null && !formless && (
          <p
            role="status"
            className="flex items-center gap-2 text-caption text-muted-foreground"
          >
            <Spinner />
            Reading how it starts…
          </p>
        )}
        {formless && (
          <p className="text-caption text-muted-foreground">
            How it starts cannot be shown while the text does not read; change
            it in Code.
          </p>
        )}
        {start.way === "webhook" && (
          <Button variant="outline" className="self-start" asChild>
            <Link href={WEBHOOKS_HREF}>
              <PlusIcon data-icon="inline-start" />
              New webhook…
            </Link>
          </Button>
        )}
        {eventType !== null && <TestEvent type={eventType} />}
        {startsByItself && <AutomaticStarts name={name} starts={starts} />}
      </div>
    </section>
  );
}

function TestEvent({ type }: { readonly type: string }) {
  const [sending, startSending] = useTransition();

  function send() {
    startSending(async () => {
      const sent = await testEventAction(type);

      if (sent.ok) {
        toast.success(TEST_EVENT_SENT);
        return;
      }

      toast.error(sent.problem.detail);
    });
  }

  return (
    <Button
      variant="outline"
      className="self-start"
      disabled={sending}
      onClick={send}
    >
      <SendIcon data-icon="inline-start" />
      Send a test event
    </Button>
  );
}

function AutomaticStarts({
  name,
  starts,
}: {
  readonly name: WorkflowName;
  readonly starts: Starts | null;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const [on, setOn] = useState(starts?.on ?? false);
  const [turning, startTurning] = useTransition();

  if (starts === null)
    return (
      <p className="text-caption text-muted-foreground">
        It will start by itself once published and turned on.
      </p>
    );

  function turn(next: boolean) {
    startTurning(async () => {
      const request = { ...name, on: next };
      const turned = await turnStartsAction(request);

      if (!turned.ok) {
        toast.error(turned.problem.detail);
        return;
      }

      setOn(next);
      const done = next
        ? "Automatic starts turned on"
        : "Automatic starts turned off";
      toast.success(done);
    });
  }

  return (
    <Field orientation="horizontal" className="items-start">
      <Switch
        id={id}
        checked={on}
        disabled={turning}
        aria-describedby={helpId}
        onCheckedChange={turn}
      />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={id}>Automatic starts</FieldLabel>
        <FieldDescription id={helpId}>
          The published version starts by itself; a draft never does.
        </FieldDescription>
      </div>
    </Field>
  );
}
