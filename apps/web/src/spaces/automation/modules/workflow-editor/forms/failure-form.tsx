'use client';

import type { JsonObject } from '@/libs/document-text/json';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/libs/ui/components/field';
import { Input } from '@/libs/ui/components/input';
import { Label } from '@/libs/ui/components/label';
import { RadioGroup, RadioGroupItem } from '@/libs/ui/components/radio-group';
import { Switch } from '@/libs/ui/components/switch';
import {
  DEFAULT_RETRY,
  type FailureChoice,
  failureChoiceOf,
  type Protection,
  withFailureChoice,
} from '../../../__shared_context/document/protection';
import type { TaskEntry } from '../../../__shared_context/document/tasks';

interface FailureFormProps {
  readonly entry: TaskEntry;
  readonly protection: Protection | null;
  readonly onChange: (task: JsonObject) => void;
}

const CHOICES: readonly {
  readonly kind: FailureChoice['kind'];
  readonly label: string;
  readonly description: string;
}[] = [
  {
    kind: 'stop',
    label: 'Stop the run',
    description: "The run ends as failed, with this step's error.",
  },
  {
    kind: 'retry',
    label: 'Try again',
    description:
      'Run the step again after a pause; the run stops if every try fails.',
  },
  {
    kind: 'continue',
    label: 'Go on',
    description:
      "Ignore the failure: the next step gets this step's input as it was.",
  },
  {
    kind: 'handle',
    label: 'Run other steps',
    description:
      'Add an "If it fails" block on the canvas, with steps that recover.',
  },
];

const MAX_RETRIES = 10;
const MAX_SECONDS = 3600;

// What happens when the step fails (FR-031), as n8n's "Retry On Fail" and "On Error" settings:
// each choice is written as a `try` around the step (research R17).
export function FailureForm({ entry, protection, onChange }: FailureFormProps) {
  const choice = failureChoiceOf(protection, entry);
  const choose = (next: FailureChoice) =>
    onChange(withFailureChoice(entry, protection, next));

  function pick(kind: string) {
    if (kind === 'retry') {
      choose(choice.kind === 'retry' ? choice : DEFAULT_RETRY);
      return;
    }

    if (kind === 'stop' || kind === 'continue' || kind === 'handle')
      choose({ kind });
  }

  return (
    <div className="flex flex-col gap-5">
      <RadioGroup value={choice.kind} onValueChange={pick} className="gap-2">
        {CHOICES.map((each) => (
          <Label
            key={each.kind}
            htmlFor={`failure-${each.kind}`}
            className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal has-data-[state=checked]:border-primary/60 has-data-[state=checked]:bg-primary/5"
          >
            <RadioGroupItem
              id={`failure-${each.kind}`}
              value={each.kind}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{each.label}</span>
              <span className="text-xs text-muted-foreground">
                {each.description}
              </span>
            </span>
          </Label>
        ))}
      </RadioGroup>
      {choice.kind === 'retry' && (
        <div className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="retry-attempts">Tries again</FieldLabel>
              <Input
                id="retry-attempts"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_RETRIES}
                value={choice.attempts}
                onChange={(event) =>
                  choose({
                    ...choice,
                    attempts: bounded(event.target.value, 1, MAX_RETRIES),
                  })
                }
              />
              <FieldDescription>times at most</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="retry-seconds">Waits</FieldLabel>
              <Input
                id="retry-seconds"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_SECONDS}
                value={choice.seconds}
                onChange={(event) =>
                  choose({
                    ...choice,
                    seconds: bounded(event.target.value, 0, MAX_SECONDS),
                  })
                }
              />
              <FieldDescription>seconds between tries</FieldDescription>
            </Field>
          </div>
          <Label className="flex items-center justify-between gap-3 font-normal">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Wait longer each time</span>
              <span className="text-xs text-muted-foreground">
                Doubles the pause after every failed try, which spares a service
                that is down.
              </span>
            </span>
            <Switch
              checked={choice.growing}
              onCheckedChange={(growing) => choose({ ...choice, growing })}
            />
          </Label>
        </div>
      )}
      {choice.kind !== 'stop' && (
        <p className="text-xs text-muted-foreground">
          On the canvas the step shows how it is protected; in the code it is a{' '}
          <code className="font-mono">try</code> around the step.
        </p>
      )}
    </div>
  );
}

function bounded(text: string, least: number, most: number): number {
  const value = Math.round(Number(text));

  if (!Number.isFinite(value)) return least;

  return Math.min(most, Math.max(least, value));
}
