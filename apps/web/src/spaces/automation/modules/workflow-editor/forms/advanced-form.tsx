'use client';

import { useState } from 'react';
import { CodeEditor } from '@/libs/code-editor/code-editor';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/libs/ui/components/field';
import { parseText, stringifyText } from '@/libs/document-text/document-text';
import { isObject } from '@/libs/document-text/json';
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
      <CodeEditor
        id="advanced-task"
        label="The task as YAML"
        language="yaml"
        value={text}
        onChange={edit}
        invalid={error !== null || problem !== null}
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
