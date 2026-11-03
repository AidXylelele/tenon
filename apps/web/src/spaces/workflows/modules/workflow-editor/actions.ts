'use server';

import { checkDocument, publishDocument } from '@/libs/data-access/automation';
import type { Outcome, Problem } from '@/libs/data-access/problem';
import type { Version } from '@/libs/data-access/types';
import type { JsonObject } from '@/libs/document-text/json';

// The platform's check of a draft: null when publishing would accept it (002 FR-003).
export async function checkAction(draft: JsonObject): Promise<Problem | null> {
  const outcome = await checkDocument(draft);
  return outcome.ok ? null : outcome.problem;
}

export async function publishAction(
  draft: JsonObject,
): Promise<Outcome<Version>> {
  return publishDocument(draft);
}
