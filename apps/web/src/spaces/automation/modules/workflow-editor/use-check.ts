'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Problem } from '@/libs/data-access/problem';
import type { JsonObject } from '@/libs/data-access/types';
import { checkAction } from './actions';

export type CheckState =
  | { readonly kind: 'checking' }
  | { readonly kind: 'clean' }
  | { readonly kind: 'problem'; readonly problem: Problem }
  | { readonly kind: 'unreachable'; readonly problem: Problem };

interface Answer {
  readonly draft: JsonObject;
  readonly problem: Problem | null;
}

const QUIET_MS = 600;

// Checks the draft with the platform once edits pause. Until the answer for the draft on
// screen arrives, the state is "checking", so an answer never speaks for an older draft
// (research R5).
export function useCheck(draft: JsonObject, enabled: boolean): CheckState {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const latest = useRef(draft);

  useEffect(() => {
    latest.current = draft;

    if (!enabled) return;

    const timer = setTimeout(() => {
      checkAction(draft).then(
        (problem) => {
          if (latest.current === draft) setAnswer({ draft, problem });
        },
        (error: unknown) => {
          if (latest.current !== draft) return;

          const detail =
            error instanceof Error ? error.message : 'The check did not answer';
          setAnswer({ draft, problem: unanswered(detail) });
        },
      );
    }, QUIET_MS);
    return () => clearTimeout(timer);
  }, [draft, enabled]);

  return useMemo(() => stateOf(answer, draft), [answer, draft]);
}

function stateOf(answer: Answer | null, draft: JsonObject): CheckState {
  if (answer === null || answer.draft !== draft) return { kind: 'checking' };

  if (answer.problem === null) return { kind: 'clean' };

  if (answer.problem.status >= 500)
    return { kind: 'unreachable', problem: answer.problem };

  return { kind: 'problem', problem: answer.problem };
}

function unanswered(detail: string): Problem {
  return {
    type: 'about:blank',
    title: 'The check did not answer',
    status: 503,
    detail,
    errors: [],
  };
}
