import type { S3Client } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';
import { IdempotencyModule } from '@nestjs/idempotency';
import { ConfigService } from '@nestjs/config';
import {
  ArtifactStore,
  FormulaEngine,
  NodeExecutor,
  NodeSamples,
  NodeTypeCatalog,
  ReleaseRepository,
  RunQueries,
  RunRepository,
  SecretCipher,
  UserRepository,
  WebhookEndpointRepository,
  WorkflowQueries,
  WorkflowRepository,
} from '../../application/interfaces.js';
import { WorkflowPolicy } from '../../application/policies/workflow.policy.js';
import { ConfigurationCheck } from '../../application/services/configuration-check.js';
import { WebhookEndpointIssuer } from '../../application/services/webhook-endpoint-issuer.js';
import { ActivateRelease } from '../../application/use-cases/activate-release.js';
import { ArchiveWorkflow } from '../../application/use-cases/archive-workflow.js';
import { BeginRun } from '../../application/use-cases/begin-run.js';
import { CancelRun } from '../../application/use-cases/cancel-run.js';
import { CreateWorkflow } from '../../application/use-cases/create-workflow.js';
import { DeactivateWorkflow } from '../../application/use-cases/deactivate-workflow.js';
import { DuplicateWorkflow } from '../../application/use-cases/duplicate-workflow.js';
import { ExecuteNode } from '../../application/use-cases/execute-node.js';
import { FinishRun } from '../../application/use-cases/finish-run.js';
import { GetRelease } from '../../application/use-cases/get-release.js';
import { GetRun } from '../../application/use-cases/get-run.js';
import { GetWorkflow } from '../../application/use-cases/get-workflow.js';
import { ListActiveSchedules } from '../../application/use-cases/list-active-schedules.js';
import { ListActiveWorkflows } from '../../application/use-cases/list-active-workflows.js';
import { ListNodeTypes } from '../../application/use-cases/list-node-types.js';
import { ListReleases } from '../../application/use-cases/list-releases.js';
import { ListRuns } from '../../application/use-cases/list-runs.js';
import { ListWebhookEndpoints } from '../../application/use-cases/list-webhook-endpoints.js';
import { ListStaleRuns } from '../../application/use-cases/list-stale-runs.js';
import { ListWorkflows } from '../../application/use-cases/list-workflows.js';
import { PinSample } from '../../application/use-cases/pin-sample.js';
import { PublishRelease } from '../../application/use-cases/publish-release.js';
import { ReachNode } from '../../application/use-cases/reach-node.js';
import { ReadStepOutput } from '../../application/use-cases/read-step-output.js';
import { RecordNode } from '../../application/use-cases/record-node.js';
import { RenameWorkflow } from '../../application/use-cases/rename-workflow.js';
import { ResolveWebhook } from '../../application/use-cases/resolve-webhook.js';
import { RestoreWorkflow } from '../../application/use-cases/restore-workflow.js';
import { RotateWebhookSecret } from '../../application/use-cases/rotate-webhook-secret.js';
import { SaveDraft } from '../../application/use-cases/save-draft.js';
import { StartManualRun } from '../../application/use-cases/start-manual-run.js';
import { StartScheduledRun } from '../../application/use-cases/start-scheduled-run.js';
import { StartTestRun } from '../../application/use-cases/start-test-run.js';
import { StartWebhookRun } from '../../application/use-cases/start-webhook-run.js';
import { TerminateRun } from '../../application/use-cases/terminate-run.js';
import { TransferWorkflow } from '../../application/use-cases/transfer-workflow.js';
import { UnpinSample } from '../../application/use-cases/unpin-sample.js';
import { ActivationController } from '../../interface-adapters/http/controllers/activation.controller.js';
import { NodeTypesController } from '../../interface-adapters/http/controllers/node-types.controller.js';
import { ReleasesController } from '../../interface-adapters/http/controllers/releases.controller.js';
import { RunsController } from '../../interface-adapters/http/controllers/runs.controller.js';
import { WebhookEndpointsController } from '../../interface-adapters/http/controllers/webhook-endpoints.controller.js';
import { WebhooksController } from '../../interface-adapters/http/controllers/webhooks.controller.js';
import { PUBLIC_BASE_URL } from '../../interface-adapters/http/public-base-url.js';
import { WorkflowsController } from '../../interface-adapters/http/controllers/workflows.controller.js';
import { CatalogueNodeExecutor } from '../../interface-adapters/node-types/catalogue-node.executor.js';
import { NodeTypeRegistry } from '../../interface-adapters/node-types/node-type.registry.js';
import { ParameterFormulaEngine } from '../../interface-adapters/node-types/parameter-formula.engine.js';
import { AggregateNode } from '../../interface-adapters/node-types/types/aggregate.node.js';
import { CompareDatasetsNode } from '../../interface-adapters/node-types/types/compare-datasets.node.js';
import { CryptoNode } from '../../interface-adapters/node-types/types/crypto.node.js';
import { DateTimeNode } from '../../interface-adapters/node-types/types/date-time.node.js';
import { EditFieldsNode } from '../../interface-adapters/node-types/types/edit-fields.node.js';
import { FilterNode } from '../../interface-adapters/node-types/types/filter.node.js';
import { HtmlNode } from '../../interface-adapters/node-types/types/html.node.js';
import { IfNode } from '../../interface-adapters/node-types/types/if.node.js';
import { LimitNode } from '../../interface-adapters/node-types/types/limit.node.js';
import { ManualTriggerNode } from '../../interface-adapters/node-types/types/manual-trigger.node.js';
import { MarkdownNode } from '../../interface-adapters/node-types/types/markdown.node.js';
import { MergeNode } from '../../interface-adapters/node-types/types/merge.node.js';
import { NoOpNode } from '../../interface-adapters/node-types/types/no-op.node.js';
import { RemoveDuplicatesNode } from '../../interface-adapters/node-types/types/remove-duplicates.node.js';
import { RenameKeysNode } from '../../interface-adapters/node-types/types/rename-keys.node.js';
import { ScheduleTriggerNode } from '../../interface-adapters/node-types/types/schedule-trigger.node.js';
import { SortNode } from '../../interface-adapters/node-types/types/sort.node.js';
import { SplitOutNode } from '../../interface-adapters/node-types/types/split-out.node.js';
import { StopAndErrorNode } from '../../interface-adapters/node-types/types/stop-and-error.node.js';
import { SummarizeNode } from '../../interface-adapters/node-types/types/summarize.node.js';
import { SwitchNode } from '../../interface-adapters/node-types/types/switch.node.js';
import { WebhookTriggerNode } from '../../interface-adapters/node-types/types/webhook-trigger.node.js';
import { XmlNode } from '../../interface-adapters/node-types/types/xml.node.js';
import { DrizzleRunQueries } from '../../interface-adapters/persistence/queries/drizzle-run.queries.js';
import { DrizzleWorkflowQueries } from '../../interface-adapters/persistence/queries/drizzle-workflow.queries.js';
import { DrizzleNodeSamples } from '../../interface-adapters/persistence/repositories/drizzle-node-samples.js';
import { DrizzleReleaseRepository } from '../../interface-adapters/persistence/repositories/drizzle-release.repository.js';
import { DrizzleRunRepository } from '../../interface-adapters/persistence/repositories/drizzle-run.repository.js';
import { DrizzleWebhookEndpointRepository } from '../../interface-adapters/persistence/repositories/drizzle-webhook-endpoint.repository.js';
import { DrizzleWorkflowRepository } from '../../interface-adapters/persistence/repositories/drizzle-workflow.repository.js';
import { AesGcmSecretCipher } from '../../interface-adapters/security/aes-gcm-secret.cipher.js';
import { DrizzleIdempotencyStore } from '../../interface-adapters/persistence/stores/drizzle-idempotency.store.js';
import { S3ArtifactStore } from '../../interface-adapters/storage/s3-artifact.store.js';
import { ActivationHandler } from '../../interface-adapters/workflows/activation.handler.js';
import { MaintenanceWorkflow } from '../../interface-adapters/workflows/maintenance.workflow.js';
import { RunLauncher } from '../../interface-adapters/workflows/run-launcher.js';
import { RunWorkflow } from '../../interface-adapters/workflows/run.workflow.js';
import { ScheduleRegistrar } from '../../interface-adapters/workflows/schedule-registrar.js';
import { ScheduledTriggerWorkflow } from '../../interface-adapters/workflows/scheduled-trigger.workflow.js';
import { createS3Client } from '../s3/client.js';
import type { Env } from './config.module.js';
import { IdentityAccessModule } from './identity-access.module.js';
import { WorkflowsModule } from './workflows.module.js';

const STEP_LIMITS = { items: 10_000, bytes: 16 * 1024 * 1024 };

const RUN_LIMITS = { runBytes: 256 * 1024 * 1024 };

const ARTIFACT_CLIENT = Symbol('ARTIFACT_CLIENT');

const IDEMPOTENCY_MODULE = IdempotencyModule.forRoot({ required: false });

const FORMULA_ENGINE = new ParameterFormulaEngine();

@Module({
  imports: [IdentityAccessModule, WorkflowsModule, IDEMPOTENCY_MODULE],
  controllers: [
    WorkflowsController,
    ReleasesController,
    RunsController,
    NodeTypesController,
    WebhookEndpointsController,
    ActivationController,
    WebhooksController,
  ],
  providers: [
    WorkflowPolicy,
    {
      provide: PUBLIC_BASE_URL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): string =>
        config.get('PUBLIC_BASE_URL', { infer: true }),
    },
    {
      provide: NodeTypeRegistry,
      useFactory: () => {
        const types = [
          new ManualTriggerNode(),
          new WebhookTriggerNode(),
          new ScheduleTriggerNode(),
          new NoOpNode(),
          new IfNode(),
          new SwitchNode(),
          new FilterNode(),
          new MergeNode(),
          new CompareDatasetsNode(),
          new StopAndErrorNode(),
          new EditFieldsNode(),
          new RenameKeysNode(),
          new AggregateNode(),
          new SplitOutNode(),
          new SummarizeNode(),
          new SortNode(),
          new LimitNode(),
          new RemoveDuplicatesNode(),
          new DateTimeNode(),
          new CryptoNode(),
          new HtmlNode(),
          new XmlNode(),
          new MarkdownNode(),
        ];
        return new NodeTypeRegistry(types);
      },
    },
    { provide: NodeTypeCatalog, useExisting: NodeTypeRegistry },
    { provide: FormulaEngine, useValue: FORMULA_ENGINE },
    {
      provide: ConfigurationCheck,
      inject: [NodeTypeCatalog],
      useFactory: (catalogue: NodeTypeCatalog) =>
        new ConfigurationCheck(catalogue),
    },
    DrizzleWorkflowRepository,
    { provide: WorkflowRepository, useExisting: DrizzleWorkflowRepository },
    DrizzleReleaseRepository,
    { provide: ReleaseRepository, useExisting: DrizzleReleaseRepository },
    DrizzleRunRepository,
    { provide: RunRepository, useExisting: DrizzleRunRepository },
    DrizzleNodeSamples,
    { provide: NodeSamples, useExisting: DrizzleNodeSamples },
    DrizzleWorkflowQueries,
    { provide: WorkflowQueries, useExisting: DrizzleWorkflowQueries },
    DrizzleWebhookEndpointRepository,
    {
      provide: WebhookEndpointRepository,
      useExisting: DrizzleWebhookEndpointRepository,
    },
    {
      provide: SecretCipher,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const keys = config.get('SECRET_KEYS', { infer: true });
        const currentKey = config.get('SECRET_KEY_CURRENT', { infer: true });
        return new AesGcmSecretCipher(keys, currentKey);
      },
    },
    {
      provide: WebhookEndpointIssuer,
      inject: [WebhookEndpointRepository, SecretCipher],
      useFactory: (
        endpoints: WebhookEndpointRepository,
        cipher: SecretCipher,
      ) => new WebhookEndpointIssuer(endpoints, cipher),
    },
    {
      provide: ListWebhookEndpoints,
      inject: [
        WorkflowQueries,
        WebhookEndpointRepository,
        SecretCipher,
        NodeTypeCatalog,
        WorkflowPolicy,
      ],
      useFactory: (
        workflows: WorkflowQueries,
        endpoints: WebhookEndpointRepository,
        cipher: SecretCipher,
        catalogue: NodeTypeCatalog,
        policy: WorkflowPolicy,
      ) =>
        new ListWebhookEndpoints(
          workflows,
          endpoints,
          cipher,
          catalogue,
          policy,
        ),
    },
    {
      provide: RotateWebhookSecret,
      inject: [
        WorkflowRepository,
        WebhookEndpointRepository,
        SecretCipher,
        NodeTypeCatalog,
        WorkflowPolicy,
      ],
      useFactory: (
        workflows: WorkflowRepository,
        endpoints: WebhookEndpointRepository,
        cipher: SecretCipher,
        catalogue: NodeTypeCatalog,
        policy: WorkflowPolicy,
      ) =>
        new RotateWebhookSecret(
          workflows,
          endpoints,
          cipher,
          catalogue,
          policy,
        ),
    },
    DrizzleRunQueries,
    { provide: RunQueries, useExisting: DrizzleRunQueries },
    {
      provide: ARTIFACT_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const endpoint = config.get('STORAGE_ENDPOINT', { infer: true });
        const region = config.get('STORAGE_REGION', { infer: true });
        const accessKey = config.get('STORAGE_ACCESS_KEY', { infer: true });
        const secretKey = config.get('STORAGE_SECRET_KEY', { infer: true });
        return createS3Client({
          STORAGE_ENDPOINT: endpoint,
          STORAGE_REGION: region,
          STORAGE_ACCESS_KEY: accessKey,
          STORAGE_SECRET_KEY: secretKey,
        });
      },
    },
    {
      provide: ArtifactStore,
      inject: [ARTIFACT_CLIENT, ConfigService],
      useFactory: (client: S3Client, config: ConfigService<Env, true>) => {
        const bucket = config.get('STORAGE_BUCKET', { infer: true });
        return new S3ArtifactStore(client, bucket);
      },
    },
    {
      provide: NodeExecutor,
      inject: [NodeTypeRegistry, ArtifactStore],
      useFactory: (registry: NodeTypeRegistry, artifacts: ArtifactStore) =>
        new CatalogueNodeExecutor(registry, artifacts, STEP_LIMITS),
    },
    {
      provide: CreateWorkflow,
      inject: [WorkflowRepository],
      useFactory: (workflows: WorkflowRepository) =>
        new CreateWorkflow(workflows),
    },
    {
      provide: RenameWorkflow,
      inject: [WorkflowRepository, WorkflowPolicy],
      useFactory: (workflows: WorkflowRepository, policy: WorkflowPolicy) =>
        new RenameWorkflow(workflows, policy),
    },
    {
      provide: SaveDraft,
      inject: [
        WorkflowRepository,
        NodeTypeCatalog,
        ConfigurationCheck,
        FormulaEngine,
        WorkflowPolicy,
        WebhookEndpointIssuer,
      ],
      useFactory: (
        workflows: WorkflowRepository,
        catalogue: NodeTypeCatalog,
        check: ConfigurationCheck,
        formulas: FormulaEngine,
        policy: WorkflowPolicy,
        issuer: WebhookEndpointIssuer,
      ) => new SaveDraft(workflows, catalogue, check, formulas, policy, issuer),
    },
    {
      provide: PinSample,
      inject: [WorkflowRepository, NodeSamples, WorkflowPolicy],
      useFactory: (
        workflows: WorkflowRepository,
        samples: NodeSamples,
        policy: WorkflowPolicy,
      ) => new PinSample(workflows, samples, policy),
    },
    {
      provide: UnpinSample,
      inject: [WorkflowRepository, NodeSamples, WorkflowPolicy],
      useFactory: (
        workflows: WorkflowRepository,
        samples: NodeSamples,
        policy: WorkflowPolicy,
      ) => new UnpinSample(workflows, samples, policy),
    },
    {
      provide: PublishRelease,
      inject: [
        WorkflowRepository,
        ReleaseRepository,
        ConfigurationCheck,
        WorkflowPolicy,
      ],
      useFactory: (
        workflows: WorkflowRepository,
        releases: ReleaseRepository,
        check: ConfigurationCheck,
        policy: WorkflowPolicy,
      ) => new PublishRelease(workflows, releases, check, policy),
    },
    {
      provide: ArchiveWorkflow,
      inject: [WorkflowRepository, WorkflowPolicy],
      useFactory: (workflows: WorkflowRepository, policy: WorkflowPolicy) =>
        new ArchiveWorkflow(workflows, policy),
    },
    {
      provide: RestoreWorkflow,
      inject: [WorkflowRepository, WorkflowPolicy],
      useFactory: (workflows: WorkflowRepository, policy: WorkflowPolicy) =>
        new RestoreWorkflow(workflows, policy),
    },
    {
      provide: DuplicateWorkflow,
      inject: [WorkflowRepository, WebhookEndpointIssuer],
      useFactory: (
        workflows: WorkflowRepository,
        issuer: WebhookEndpointIssuer,
      ) => new DuplicateWorkflow(workflows, issuer),
    },
    {
      provide: TransferWorkflow,
      inject: [WorkflowRepository, UserRepository, WorkflowPolicy],
      useFactory: (
        workflows: WorkflowRepository,
        users: UserRepository,
        policy: WorkflowPolicy,
      ) => new TransferWorkflow(workflows, users, policy),
    },
    {
      provide: GetWorkflow,
      inject: [WorkflowQueries, ConfigurationCheck, WorkflowPolicy],
      useFactory: (
        workflows: WorkflowQueries,
        check: ConfigurationCheck,
        policy: WorkflowPolicy,
      ) => new GetWorkflow(workflows, check, policy),
    },
    {
      provide: ListWorkflows,
      inject: [WorkflowQueries],
      useFactory: (workflows: WorkflowQueries) => new ListWorkflows(workflows),
    },
    {
      provide: ListReleases,
      inject: [WorkflowQueries],
      useFactory: (workflows: WorkflowQueries) => new ListReleases(workflows),
    },
    {
      provide: GetRelease,
      inject: [WorkflowQueries],
      useFactory: (workflows: WorkflowQueries) => new GetRelease(workflows),
    },
    {
      provide: ListNodeTypes,
      inject: [NodeTypeCatalog],
      useFactory: (catalogue: NodeTypeCatalog) => new ListNodeTypes(catalogue),
    },
    {
      provide: StartTestRun,
      inject: [
        WorkflowRepository,
        RunRepository,
        ArtifactStore,
        NodeSamples,
        ConfigurationCheck,
        WorkflowPolicy,
      ],
      useFactory: (
        workflows: WorkflowRepository,
        runs: RunRepository,
        artifacts: ArtifactStore,
        samples: NodeSamples,
        check: ConfigurationCheck,
        policy: WorkflowPolicy,
      ) => new StartTestRun(workflows, runs, artifacts, samples, check, policy),
    },
    {
      provide: StartManualRun,
      inject: [
        WorkflowRepository,
        ReleaseRepository,
        RunRepository,
        ArtifactStore,
        WorkflowPolicy,
      ],
      useFactory: (
        workflows: WorkflowRepository,
        releases: ReleaseRepository,
        runs: RunRepository,
        artifacts: ArtifactStore,
        policy: WorkflowPolicy,
      ) => new StartManualRun(workflows, releases, runs, artifacts, policy),
    },
    {
      provide: CancelRun,
      inject: [RunRepository, WorkflowRepository, WorkflowPolicy],
      useFactory: (
        runs: RunRepository,
        workflows: WorkflowRepository,
        policy: WorkflowPolicy,
      ) => new CancelRun(runs, workflows, policy),
    },
    {
      provide: BeginRun,
      inject: [RunRepository],
      useFactory: (runs: RunRepository) => new BeginRun(runs),
    },
    {
      provide: ReachNode,
      inject: [RunRepository],
      useFactory: (runs: RunRepository) => new ReachNode(runs),
    },
    {
      provide: ExecuteNode,
      inject: [RunRepository, NodeExecutor],
      useFactory: (runs: RunRepository, executor: NodeExecutor) =>
        new ExecuteNode(runs, executor),
    },
    {
      provide: RecordNode,
      inject: [RunRepository, NodeSamples],
      useFactory: (runs: RunRepository, samples: NodeSamples) =>
        new RecordNode(runs, samples, RUN_LIMITS),
    },
    {
      provide: FinishRun,
      inject: [RunRepository],
      useFactory: (runs: RunRepository) => new FinishRun(runs),
    },
    {
      provide: TerminateRun,
      inject: [RunRepository],
      useFactory: (runs: RunRepository) => new TerminateRun(runs),
    },
    {
      provide: GetRun,
      inject: [RunQueries],
      useFactory: (runs: RunQueries) => new GetRun(runs),
    },
    {
      provide: ListRuns,
      inject: [WorkflowQueries, RunQueries],
      useFactory: (workflows: WorkflowQueries, runs: RunQueries) =>
        new ListRuns(workflows, runs),
    },
    {
      provide: ListStaleRuns,
      inject: [RunQueries],
      useFactory: (runs: RunQueries) => new ListStaleRuns(runs),
    },
    {
      provide: ReadStepOutput,
      inject: [RunQueries, ArtifactStore],
      useFactory: (runs: RunQueries, artifacts: ArtifactStore) =>
        new ReadStepOutput(runs, artifacts),
    },
    {
      provide: ActivateRelease,
      inject: [
        WorkflowRepository,
        ReleaseRepository,
        ConfigurationCheck,
        WorkflowPolicy,
      ],
      useFactory: (
        workflows: WorkflowRepository,
        releases: ReleaseRepository,
        check: ConfigurationCheck,
        policy: WorkflowPolicy,
      ) => new ActivateRelease(workflows, releases, check, policy),
    },
    {
      provide: DeactivateWorkflow,
      inject: [WorkflowRepository, WorkflowPolicy],
      useFactory: (workflows: WorkflowRepository, policy: WorkflowPolicy) =>
        new DeactivateWorkflow(workflows, policy),
    },
    {
      provide: ListActiveSchedules,
      inject: [WorkflowQueries, NodeTypeCatalog],
      useFactory: (workflows: WorkflowQueries, catalogue: NodeTypeCatalog) =>
        new ListActiveSchedules(workflows, catalogue),
    },
    {
      provide: ListActiveWorkflows,
      inject: [WorkflowQueries],
      useFactory: (workflows: WorkflowQueries) =>
        new ListActiveWorkflows(workflows),
    },
    {
      provide: StartScheduledRun,
      inject: [
        WorkflowRepository,
        ReleaseRepository,
        RunRepository,
        ArtifactStore,
      ],
      useFactory: (
        workflows: WorkflowRepository,
        releases: ReleaseRepository,
        runs: RunRepository,
        artifacts: ArtifactStore,
      ) => new StartScheduledRun(workflows, releases, runs, artifacts),
    },
    {
      provide: ResolveWebhook,
      inject: [
        WebhookEndpointRepository,
        WorkflowQueries,
        SecretCipher,
        NodeTypeCatalog,
      ],
      useFactory: (
        endpoints: WebhookEndpointRepository,
        workflows: WorkflowQueries,
        cipher: SecretCipher,
        catalogue: NodeTypeCatalog,
      ) => new ResolveWebhook(endpoints, workflows, cipher, catalogue),
    },
    {
      provide: StartWebhookRun,
      inject: [
        WorkflowRepository,
        ReleaseRepository,
        RunRepository,
        ArtifactStore,
      ],
      useFactory: (
        workflows: WorkflowRepository,
        releases: ReleaseRepository,
        runs: RunRepository,
        artifacts: ArtifactStore,
      ) => new StartWebhookRun(workflows, releases, runs, artifacts),
    },
    DrizzleIdempotencyStore,
    RunLauncher,
    RunWorkflow,
    ScheduleRegistrar,
    ScheduledTriggerWorkflow,
    ActivationHandler,
    MaintenanceWorkflow,
  ],
})
export class AutomationModule {}
