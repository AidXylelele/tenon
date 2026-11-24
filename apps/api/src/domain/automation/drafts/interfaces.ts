import type { JsonObject } from "../interfaces.js";
import type { WorkflowName } from "../workflows/workflow-name.js";

export interface DraftAuthor {
  readonly id: string;
  readonly name: string;
}

export interface DraftProps {
  readonly name: WorkflowName;
  readonly source: string;
  readonly layout: JsonObject;
  readonly revision: string;
  readonly basis: string | null;
  readonly savedBy: DraftAuthor;
  readonly savedAt: Date;
}

export interface NewDraft {
  readonly name: WorkflowName;
  readonly source: string;
  readonly layout: JsonObject;
  readonly author: DraftAuthor;
  readonly now: Date;
}

export interface DraftEdit {
  readonly expected: string;
  readonly source: string;
  readonly layout: JsonObject;
  readonly author: DraftAuthor;
  readonly now: Date;
}

export interface DraftSnapshot {
  readonly source: string;
  readonly layout: JsonObject;
  readonly revision: string;
  readonly savedBy: DraftAuthor;
  readonly savedAt: Date;
}
