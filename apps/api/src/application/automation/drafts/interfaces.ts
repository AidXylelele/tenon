import type { Draft } from "../../../domain/automation/drafts/draft.js";
import type { DraftRefusal } from "../../../domain/automation/drafts/enums.js";
import type { DraftAuthor } from "../../../domain/automation/drafts/interfaces.js";
import type {
  JsonObject,
  JsonValue,
} from "../../../domain/automation/interfaces.js";
import type { CheckedDefinition } from "../../../domain/automation/workflows/checked-definition.js";
import type { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { Result } from "../../../domain/interfaces.js";
import type { Missing } from "../enums.js";
import type { InputProblem, StartedInstance } from "../instances/interfaces.js";
import type { NameRefusal } from "./enums.js";
import type {
  DefinitionFailure,
  PublishedVersion,
  PublishFailure,
} from "../workflows/interfaces.js";

export interface CreateDraftCommand {
  readonly name: WorkflowName;
  readonly source: string;
  readonly layout: JsonObject;
  readonly author: DraftAuthor;
}

export interface SaveDraftCommand extends CreateDraftCommand {
  readonly expected: string;
}

export interface DiscardDraftCommand {
  readonly name: WorkflowName;
  readonly expected: string;
}

export type DiscardDraftResult = Result<void, DraftConflict | Missing>;

export interface PublishDraftCommand {
  readonly name: WorkflowName;
  readonly expected: string;
  readonly publisherId: string;
}

export interface TestDraftCommand {
  readonly name: WorkflowName;
  readonly expected: string;
  readonly input: JsonValue;
  readonly starterId: string;
}

export interface DraftView {
  readonly source: string;
  readonly layout: JsonObject;
  readonly revision: string;
  readonly savedBy: DraftAuthor;
  readonly savedAt: Date;
}

export interface DraftConflict {
  readonly refusal: DraftRefusal;
  readonly current: DraftView | null;
}

interface CompiledDraft {
  readonly draft: Draft;
  readonly definition: CheckedDefinition;
}

export type DraftCompilationResult = Result<
  CompiledDraft,
  DefinitionFailure | DraftConflict | Missing
>;

export type CreateDraftResult = Result<DraftView, DraftConflict | NameRefusal>;

export type DraftResult = Result<DraftView, DraftConflict>;

export type PublishDraftResult = Result<
  PublishedVersion,
  PublishFailure | DraftConflict | Missing
>;

export interface RefusedInput {
  readonly inputProblems: readonly InputProblem[];
}

export type TestDraftResult = Result<
  StartedInstance,
  PublishFailure | DraftConflict | Missing | RefusedInput
>;
