import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ErrorKind,
  OnError,
  ProblemCode,
  RunMode,
  RunStatus,
  StepStatus,
  TriggerType,
} from '../../../domain/enums.js';

export class UserRefResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class ProblemResponse {
  @ApiProperty({ type: 'string', nullable: true })
  nodeId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  parameter!: string | null;

  @ApiProperty({ enum: ProblemCode })
  code!: ProblemCode;

  @ApiProperty()
  message!: string;
}

export class FieldShapeResponse {
  @ApiProperty()
  path!: string;

  @ApiProperty({
    enum: ['string', 'number', 'boolean', 'object', 'array', 'null'],
  })
  type!: string;
}

export class NodeSampleResponse {
  @ApiProperty()
  nodeId!: string;

  @ApiProperty()
  pinned!: boolean;

  @ApiProperty({ type: [FieldShapeResponse] })
  fields!: FieldShapeResponse[];
}

export class RetryResponse {
  @ApiProperty()
  attempts!: number;

  @ApiProperty()
  waitMs!: number;
}

export class NodeSettingsResponse {
  @ApiProperty()
  alwaysOutputData!: boolean;

  @ApiProperty()
  executeOnce!: boolean;

  @ApiProperty({ type: RetryResponse })
  retry!: RetryResponse;

  @ApiProperty({ enum: OnError })
  onError!: OnError;
}

export class NodeResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  typeVersion!: number;

  @ApiProperty({ enum: TriggerType, nullable: true })
  trigger!: TriggerType | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  parameters!: Record<string, unknown>;

  @ApiProperty({ type: 'string', nullable: true })
  credentialId!: string | null;

  @ApiProperty({ type: NodeSettingsResponse })
  settings!: NodeSettingsResponse;

  @ApiProperty({ type: [Number] })
  position!: [number, number];

  @ApiProperty({ type: 'string', nullable: true })
  note!: string | null;

  @ApiProperty()
  disabled!: boolean;
}

export class ConnectionOutputResponse {
  @ApiProperty()
  node!: string;

  @ApiProperty()
  output!: string;
}

export class ConnectionInputResponse {
  @ApiProperty()
  node!: string;

  @ApiProperty()
  input!: string;
}

export class ConnectionResponse {
  @ApiProperty({ type: ConnectionOutputResponse })
  from!: ConnectionOutputResponse;

  @ApiProperty({ type: ConnectionInputResponse })
  to!: ConnectionInputResponse;
}

export class GraphResponse {
  @ApiProperty({ type: [NodeResponse] })
  nodes!: NodeResponse[];

  @ApiProperty({ type: [ConnectionResponse] })
  connections!: ConnectionResponse[];
}

export class WorkflowSettingsResponse {
  @ApiProperty()
  timezone!: string;

  @ApiProperty()
  runTimeoutMs!: number;

  @ApiProperty({ type: 'string', nullable: true })
  errorWorkflowId!: string | null;
}

export class WorkflowSummaryResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: UserRefResponse })
  owner!: UserRefResponse;

  @ApiProperty()
  archived!: boolean;

  @ApiProperty({ description: '0 when never published' })
  latestRelease!: number;

  @ApiProperty({ type: 'integer', nullable: true })
  activeRelease!: number | null;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class WorkflowPageResponse {
  @ApiProperty({ type: [WorkflowSummaryResponse] })
  items!: WorkflowSummaryResponse[];

  @ApiProperty({ type: 'string', nullable: true })
  nextCursor!: string | null;
}

export class DraftResponse {
  @ApiProperty()
  revision!: number;

  @ApiProperty({ type: GraphResponse })
  graph!: GraphResponse;

  @ApiProperty({ type: WorkflowSettingsResponse })
  settings!: WorkflowSettingsResponse;

  @ApiProperty({
    type: [ProblemResponse],
    description:
      'Node configuration problems; they block publishing, test runs and activation',
  })
  problems!: ProblemResponse[];
}

export class WorkflowResponse extends WorkflowSummaryResponse {
  @ApiProperty({
    description: 'Whether the caller may change, publish and run it',
  })
  canManage!: boolean;

  @ApiProperty({ type: DraftResponse })
  draft!: DraftResponse;

  @ApiProperty({ type: [NodeSampleResponse] })
  samples!: NodeSampleResponse[];
}

export class SavedDraftResponse {
  @ApiProperty()
  revision!: number;

  @ApiProperty({ type: [ProblemResponse] })
  problems!: ProblemResponse[];
}

export class ReleaseSummaryResponse {
  @ApiProperty()
  number!: number;

  @ApiProperty({ format: 'date-time' })
  publishedAt!: Date;

  @ApiProperty({ type: UserRefResponse })
  publishedBy!: UserRefResponse;
}

export class ReleaseListResponse {
  @ApiProperty({ type: [ReleaseSummaryResponse] })
  items!: ReleaseSummaryResponse[];
}

export class ReleaseResponse extends ReleaseSummaryResponse {
  @ApiProperty({ type: GraphResponse })
  graph!: GraphResponse;

  @ApiProperty({ type: WorkflowSettingsResponse })
  settings!: WorkflowSettingsResponse;
}

export class RunErrorResponse {
  @ApiProperty({ type: 'string', nullable: true })
  nodeId!: string | null;

  @ApiProperty({ enum: ErrorKind })
  kind!: ErrorKind;

  @ApiProperty()
  message!: string;
}

export class RunSummaryResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: RunStatus })
  status!: RunStatus;

  @ApiProperty({ enum: RunMode })
  mode!: RunMode;

  @ApiProperty({ enum: TriggerType })
  trigger!: TriggerType;

  @ApiProperty({ type: 'integer', nullable: true })
  release!: number | null;

  @ApiProperty({ format: 'date-time' })
  queuedAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  startedAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  finishedAt!: Date | null;

  @ApiProperty({ type: RunErrorResponse, nullable: true })
  error!: RunErrorResponse | null;
}

export class RunPageResponse {
  @ApiProperty({ type: [RunSummaryResponse] })
  items!: RunSummaryResponse[];

  @ApiProperty({ type: 'string', nullable: true })
  nextCursor!: string | null;
}

export class StepOutputSummaryResponse {
  @ApiProperty()
  port!: string;

  @ApiProperty()
  items!: number;

  @ApiProperty()
  bytes!: number;
}

export class StepErrorResponse {
  @ApiProperty({ enum: ErrorKind })
  kind!: ErrorKind;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  parameter!: string | null;

  @ApiPropertyOptional({ type: 'integer', nullable: true })
  itemIndex!: number | null;
}

export class StepResponse {
  @ApiProperty()
  nodeId!: string;

  @ApiProperty({ enum: StepStatus })
  status!: StepStatus;

  @ApiProperty()
  attempts!: number;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  startedAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  finishedAt!: Date | null;

  @ApiProperty({ type: [StepOutputSummaryResponse] })
  outputs!: StepOutputSummaryResponse[];

  @ApiProperty({ type: StepErrorResponse, nullable: true })
  error!: StepErrorResponse | null;
}

export class RunResponse extends RunSummaryResponse {
  @ApiProperty({ format: 'uuid' })
  workflowId!: string;

  @ApiProperty({ type: [StepResponse] })
  steps!: StepResponse[];
}

export class QueuedRunResponse {
  @ApiProperty({ format: 'uuid' })
  runId!: string;
}

export class StepOutputPageResponse {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  items!: Record<string, unknown>[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  offset!: number;
}

export class NodeTypeResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty({ enum: ['trigger', 'action', 'transform'] })
  kind!: string;

  @ApiProperty({ enum: TriggerType, nullable: true })
  trigger!: TriggerType | null;

  @ApiProperty()
  category!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'JSON Schema 2020-12 of the parameters',
  })
  parameters!: Record<string, unknown>;

  @ApiProperty({ type: [String] })
  inputs!: string[];

  @ApiProperty({
    description: 'Fixed port names, or the parameter that defines them',
    oneOf: [
      { type: 'array', items: { type: 'string' } },
      { type: 'object', properties: { fromParameter: { type: 'string' } } },
    ],
  })
  outputs!: string[] | { fromParameter: string };

  @ApiProperty({ type: [String] })
  credentialTypes!: string[];

  @ApiProperty({ type: NodeSettingsResponse })
  defaultSettings!: NodeSettingsResponse;
}

export class CatalogueResponse {
  @ApiProperty({ type: [NodeTypeResponse] })
  nodeTypes!: NodeTypeResponse[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  credentialTypes!: Record<string, unknown>[];
}

export class WebhookEndpointResponse {
  @ApiProperty()
  nodeId!: string;

  @ApiProperty({ format: 'uri' })
  url!: string;

  @ApiProperty({
    type: [String],
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })
  methods!: string[];

  @ApiProperty({ type: 'string', enum: ['token', 'signature'], nullable: true })
  authentication!: string | null;

  @ApiProperty({
    type: 'string',
    nullable: true,
    description:
      '256 random bits; sent as x-webhook-token or used as the HMAC key; null while the key that encrypted it is not configured',
  })
  secret!: string | null;
}

export class WebhookEndpointListResponse {
  @ApiProperty({ type: [WebhookEndpointResponse] })
  items!: WebhookEndpointResponse[];
}

export class ActivationResponse {
  @ApiProperty({ description: 'The active release' })
  release!: number;
}
