'use client';

import { useState } from 'react';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/libs/ui/components/field';
import { Textarea } from '@/libs/ui/components/textarea';
import { parseText, stringifyText } from '@/libs/document-text/document-text';
import { isObject } from '../../../__shared_context/document/json';
import { useFieldProblem } from '../editing-context';
import type { TaskFormProps } from './task-form';

// A task no form covers, edited as YAML: it is written back whenever the text parses to an
// object, and otherwise kept as it was (spec US4 scenario 2).
export function AdvancedForm({ task, onChange }: TaskFormProps) {
  const [text, setText] = useState(() => stringifyText(task, 'yaml'));
  const [error, setError] = useState<string | null>(null);
  const problem = useFieldProblem('');

  function edit(next: string) {
    setText(next);
    const parsed = parseText(next);

    if (!parsed.ok) {
      setError(`Line ${parsed.error.line}: ${parsed.error.message}`);
      return;
    }

    if (!isObject(parsed.value)) {
      setError('A task is an object of its properties');
      return;
    }

    setError(null);
    onChange(parsed.value);
  }

  return (
    <Field data-invalid={error !== null || problem !== null}>
      <FieldLabel htmlFor="advanced-task">Task as YAML</FieldLabel>
      <Textarea
        id="advanced-task"
        rows={14}
        spellCheck={false}
        value={text}
        onChange={(event) => edit(event.target.value)}
        className="font-mono text-xs"
      />
      {error !== null ? (
        <FieldError>{error}</FieldError>
      ) : problem !== null ? (
        <FieldError>{problem}</FieldError>
      ) : (
        <FieldDescription>
          Any task of the Open Workflow DSL 1.0.3. The check below says whether
          the platform runs it.
        </FieldDescription>
      )}
    </Field>
  );
}
