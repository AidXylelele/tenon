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
import { SetKind } from '../runtime/execution/kinds/set-kind.js';
import { SwitchKind } from '../runtime/execution/kinds/switch-kind.js';
import { TryKind } from '../runtime/execution/kinds/try-kind.js';
import { WaitKind } from '../runtime/execution/kinds/wait-kind.js';
import { TaskKindRegistry } from '../runtime/execution/task-kind-registry.js';
import { TaskRunner } from '../runtime/execution/task-runner.js';
import {
  EndpointClient,
  JqClient,
  JsonSchemaClient,
} from '../runtime/interfaces.js';
import { Runtime } from '../runtime/runtime.js';
import { AjvModule } from './ajv.module.js';
import { JqModule } from './jq.module.js';
import { UndiciModule } from './undici.module.js';

// `$runtime.version` is the deployed API's own, as package.json states it.
const manifest = createRequire(import.meta.url)('../../../package.json') as {
  readonly version: string;
};

@Module({
  imports: [JqModule, AjvModule, UndiciModule],
  providers: [
    {
      provide: RuntimeChecks,
      inject: [JqClient, JsonSchemaClient],
      useFactory: (jq: JqClient, schemas: JsonSchemaClient) => {
        const schema = new SchemaCheck();
        const checks = [
          new DslVersionCheck(),
          new SubsetCheck(),
          new TaskNameCheck(),
          new ReferenceCheck(),
          new DurationCheck(),
          new ExpressionCheck(jq),
          new SchemaDocumentCheck(schemas),
        ];
        return new DefinitionChecks(schema, checks);
      },
    },
    {
      provide: Runtime,
      inject: [JqClient, JsonSchemaClient, EndpointClient],
      useFactory: (
        jq: JqClient,
        schemas: JsonSchemaClient,
        endpoints: EndpointClient,
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
        ]);
        const composites = new Map<string, CompositeKind>([
          ['do', new DoKind()],
          ['for', new ForKind(evaluator)],
          ['fork', new ForkKind()],
          ['wait', new WaitKind(evaluator)],
          ['call:function', new FunctionCallKind(evaluator)],
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
  exports: [RuntimeChecks, Runtime],
})
export class RuntimeModule {}
