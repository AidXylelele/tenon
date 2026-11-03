import { createRequire } from 'node:module';
import { Module } from '@nestjs/common';
import { RuntimeChecks } from '../../interface-adapters/workflows/interfaces.js';
import { DefinitionChecks } from '../runtime/checking/definition-checks.js';
import { DslVersionCheck } from '../runtime/checking/dsl-version-check.js';
import { DurationCheck } from '../runtime/checking/duration-check.js';
import { ExpressionCheck } from '../runtime/checking/expression-check.js';
import { ReferenceCheck } from '../runtime/checking/reference-check.js';
import { SchemaCheck } from '../runtime/checking/schema-check.js';
import { SchemaDocumentCheck } from '../runtime/checking/schema-document-check.js';
import { SubsetCheck } from '../runtime/checking/subset-check.js';
import { TaskNameCheck } from '../runtime/checking/task-name-check.js';
import { DataFlow } from '../runtime/execution/data-flow.js';
import type { CompositeKind, LeafKind } from '../runtime/execution/endings.js';
import { Evaluator } from '../runtime/execution/evaluator.js';
import { DoKind } from '../runtime/execution/kinds/do-kind.js';
import { EmitKind } from '../runtime/execution/kinds/emit-kind.js';
import { ForKind } from '../runtime/execution/kinds/for-kind.js';
import { ForkKind } from '../runtime/execution/kinds/fork-kind.js';
import { FunctionCallKind } from '../runtime/execution/kinds/function-call-kind.js';
import { Authorizations } from '../runtime/execution/kinds/http/authorizations.js';
import { HttpCallKind } from '../runtime/execution/kinds/http/http-call-kind.js';
import { OpenApiCallKind } from '../runtime/execution/kinds/http/openapi-call-kind.js';
import { RaiseKind } from '../runtime/execution/kinds/raise-kind.js';
import { DetachedProcessKind } from '../runtime/execution/kinds/run/detached-process-kind.js';
import { ProcessKind } from '../runtime/execution/kinds/run/process-kind.js';
import { WorkflowKind } from '../runtime/execution/kinds/run/workflow-kind.js';
import { SetKind } from '../runtime/execution/kinds/set-kind.js';
import { SwitchKind } from '../runtime/execution/kinds/switch-kind.js';
import { TryKind } from '../runtime/execution/kinds/try-kind.js';
import { WaitKind } from '../runtime/execution/kinds/wait-kind.js';
import { CronCheck } from '../runtime/checking/cron-check.js';
import { ScheduleTriggers } from '../runtime/schedule-triggers.js';
import { EngineCronClient } from '../workflows/engine-cron.client.js';
import {
  FilterClient,
  TriggerClient,
} from '../../interface-adapters/workflows/interfaces.js';
import { SubscriptionFilterClient } from '../runtime/subscription-filter.client.js';
import { ListenKind } from '../runtime/execution/kinds/listen-kind.js';
import { EventFilters } from '../runtime/execution/events/event-filters.js';
import { TaskKindRegistry } from '../runtime/execution/task-kind-registry.js';
import { TaskRunner } from '../runtime/execution/task-runner.js';
import {
  CronClient,
  EndpointClient,
  JqClient,
  JsonSchemaClient,
  SandboxClient,
  SandboxLimits,
} from '../runtime/interfaces.js';
import { Runtime } from '../runtime/runtime.js';
import { AjvModule } from './ajv.module.js';
import { GoJudgeModule } from './go-judge.module.js';
import { JqModule } from './jq.module.js';
import { UndiciModule } from './undici.module.js';

// `$runtime.version` is the deployed API's own, as package.json states it.
const manifest = createRequire(import.meta.url)('../../../package.json') as {
  readonly version: string;
};

@Module({
  imports: [JqModule, AjvModule, UndiciModule, GoJudgeModule],
  providers: [
    { provide: CronClient, useClass: EngineCronClient },
    {
      provide: TriggerClient,
      inject: [JqClient],
      useFactory: (jq: JqClient) => {
        const evaluator = new Evaluator(jq);
        const filters = new EventFilters(evaluator);
        return new ScheduleTriggers(filters);
      },
    },
    {
      provide: FilterClient,
      inject: [JqClient],
      useFactory: (jq: JqClient) => {
        const evaluator = new Evaluator(jq);
        const filters = new EventFilters(evaluator);
        return new SubscriptionFilterClient(filters, jq);
      },
    },
    {
      provide: RuntimeChecks,
      inject: [JqClient, JsonSchemaClient, CronClient],
      useFactory: (
        jq: JqClient,
        schemas: JsonSchemaClient,
        crons: CronClient,
      ) => {
        const schema = new SchemaCheck();
        const checks = [
          new DslVersionCheck(),
          new SubsetCheck(),
          new TaskNameCheck(),
          new ReferenceCheck(),
          new DurationCheck(),
          new CronCheck(crons),
          new ExpressionCheck(jq),
          new SchemaDocumentCheck(schemas),
        ];
        return new DefinitionChecks(schema, checks);
      },
    },
    {
      provide: Runtime,
      inject: [
        JqClient,
        JsonSchemaClient,
        EndpointClient,
        SandboxClient,
        SandboxLimits,
      ],
      useFactory: (
        jq: JqClient,
        schemas: JsonSchemaClient,
        endpoints: EndpointClient,
        sandbox: SandboxClient,
        limits: SandboxLimits,
      ) => {
        const evaluator = new Evaluator(jq);
        const flow = new DataFlow(evaluator, schemas);
        const authorizations = new Authorizations(evaluator);
        const leaves = new Map<string, LeafKind>([
          ['set', new SetKind(evaluator)],
          ['switch', new SwitchKind(evaluator)],
          ['raise', new RaiseKind(evaluator)],
          ['emit', new EmitKind(evaluator)],
          ['call:http', new HttpCallKind(endpoints, authorizations, evaluator)],
          [
            'call:openapi',
            new OpenApiCallKind(endpoints, authorizations, evaluator),
          ],
          ['run:script', new ProcessKind(sandbox, limits, evaluator)],
          ['run:shell', new ProcessKind(sandbox, limits, evaluator)],
        ]);
        const composites = new Map<string, CompositeKind>([
          ['do', new DoKind()],
          ['for', new ForKind(evaluator)],
          ['fork', new ForkKind()],
          ['wait', new WaitKind(evaluator)],
          ['listen', new ListenKind(new EventFilters(evaluator), evaluator)],
          ['call:function', new FunctionCallKind(evaluator)],
          ['run:detached', new DetachedProcessKind(limits, evaluator)],
          ['run:workflow', new WorkflowKind(evaluator)],
        ]);
        const registry = new TaskKindRegistry(leaves, composites);
        composites.set('try', new TryKind(evaluator, registry));
        const runner = new TaskRunner(registry, flow, evaluator);
        const descriptor = {
          name: 'workflow-platform',
          version: manifest.version,
        };
        return new Runtime(runner, flow, descriptor);
      },
    },
  ],
  exports: [RuntimeChecks, Runtime, TriggerClient, FilterClient, GoJudgeModule],
})
export class RuntimeModule {}
