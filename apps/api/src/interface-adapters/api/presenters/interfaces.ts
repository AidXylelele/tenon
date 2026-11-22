import type { HttpStatus } from "@nestjs/common";
import type { NameRefusal } from "../../../application/automation/drafts/enums.js";
import type { Missing } from "../../../application/automation/enums.js";
import type { ImportRefusal } from "../../../application/automation/imports/enums.js";
import type { EndpointRefusal } from "../../../application/automation/subscriptions/enums.js";
import type { DefinitionRefusal } from "../../../application/automation/workflows/enums.js";
import type { DefinitionProblem } from "../../../application/automation/workflows/interfaces.js";
import type { Missing as IdentityMissing } from "../../../application/identity/enums.js";
import type { DraftRefusal } from "../../../domain/automation/drafts/enums.js";
import type { InstanceRefusal } from "../../../domain/automation/instances/enums.js";
import type { SecretRefusal } from "../../../domain/automation/secrets/enums.js";
import type { SubscriptionRefusal } from "../../../domain/automation/subscriptions/enums.js";
import type { WorkflowRefusal } from "../../../domain/automation/workflows/enums.js";
import type {
  AccountRefusal,
  InvitationRefusal,
  UserRefusal,
} from "../../../domain/identity/enums.js";

export type Refusal =
  | DefinitionRefusal
  | WorkflowRefusal
  | InstanceRefusal
  | SecretRefusal
  | SubscriptionRefusal
  | EndpointRefusal
  | DraftRefusal
  | NameRefusal
  | ImportRefusal
  | Missing
  | AccountRefusal
  | UserRefusal
  | InvitationRefusal
  | IdentityMissing;

export type Failure = Refusal | readonly DefinitionProblem[];

export interface Described {
  readonly status: HttpStatus;
  readonly title: string;
  readonly detail: string;
}
