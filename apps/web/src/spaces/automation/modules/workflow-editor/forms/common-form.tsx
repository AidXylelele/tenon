'use client';

import {
  durationOf,
  durationValue,
} from '../../../__shared_context/document/trigger';
import { useEditing } from '../editing-context';
import { ChoiceField, DurationField, TextField } from './fields';
import { type TaskFormProps, taskEditor } from './task-form';

const NEXT = 'next';

// What every task can carry, the panel's Data tab: a condition, where the run goes after it,
// how its output is shaped and exported, and how long it may take (DSL 1.0.3, task).
export function CommonForm(props: TaskFormProps) {
  const edit = taskEditor(props);
  const { siblingNames } = useEditing();
  const then = edit.text('/then');
  const timeout = durationOf(edit.value('/timeout/after'));
  const targets = [
    { value: NEXT, label: 'The next step' },
    { value: 'exit', label: 'Leave the current block' },
    { value: 'end', label: 'End the run' },
    ...siblingNames.map((name) => ({ value: name, label: `Jump to ${name}` })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <TextField
        id="common-if"
        label="Run only when"
        at="if"
        optional
        mono
        value={edit.text('/if')}
        onChange={(condition) => edit.set('/if', condition)}
        placeholder="${ .lead.score > 50 }"
        description="Skipped when the expression is false."
      />
      <ChoiceField
        id="common-then"
        label="Afterwards go to"
        at="then"
        value={then === '' || then === 'continue' ? NEXT : then}
        onChange={(next) => edit.set('/then', next === NEXT ? undefined : next)}
        options={
          targets.some((target) => target.value === then) || then === ''
            ? targets
            : [...targets, { value: then, label: then }]
        }
      />
      <TextField
        id="common-output"
        label="Keep as output"
        at="output/as"
        optional
        mono
        value={edit.text('/output/as')}
        onChange={(as) => edit.set('/output/as', as)}
        placeholder="${ .body.items }"
        description="Shape what this step passes on."
      />
      <TextField
        id="common-export"
        label="Remember for later steps"
        at="export/as"
        optional
        mono
        value={edit.text('/export/as')}
        onChange={(as) => edit.set('/export/as', as)}
        placeholder="${ $context + { lead: . } }"
        description="Read it as $context in the steps after this one."
      />
      <DurationField
        id="common-timeout"
        label="Give up after"
        at="timeout"
        optional
        value={timeout}
        onChange={(next) =>
          edit.set('/timeout', { after: durationValue(next) })
        }
      />
      {timeout !== null && (
        <button
          type="button"
          className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => edit.set('/timeout', undefined)}
        >
          Remove the time limit
        </button>
      )}
    </div>
  );
}
