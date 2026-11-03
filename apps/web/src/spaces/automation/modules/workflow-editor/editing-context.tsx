'use client';

import { createContext, useContext } from 'react';
import {
  isFieldOf,
  type LocatedProblem,
} from '../../__shared_context/document/problems';

// What a form needs beyond its task: where the check's problem lies, the author's secrets, the
// names a `then` may jump to, and the script languages the platform runs.
export interface EditingContextValue {
  readonly located: LocatedProblem | null;
  readonly taskPointer: string | null;
  readonly secretNames: readonly string[];
  readonly siblingNames: readonly string[];
  readonly scriptLanguages: readonly string[];
}

const EditingContext = createContext<EditingContextValue>({
  located: null,
  taskPointer: null,
  secretNames: [],
  siblingNames: [],
  scriptLanguages: [],
});

export const EditingProvider = EditingContext.Provider;

export function useEditing(): EditingContextValue {
  return useContext(EditingContext);
}

// The check's problem when it lies in the field that edits `at` (a path inside the task, or
// inside the document for the header and trigger); an `exact` field takes only its own path,
// not those of the fields inside it.
export function useFieldProblem(at: string, exact = false): string | null {
  const { located, taskPointer } = useContext(EditingContext);

  if (located === null || located.taskPointer !== taskPointer) return null;

  const here = exact ? located.field === at : isFieldOf(located.field, at);
  return here ? located.detail : null;
}
