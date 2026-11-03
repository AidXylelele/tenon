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
import { JqClient, JsonSchemaClient } from '../runtime/interfaces.js';
import { AjvModule } from './ajv.module.js';
import { JqModule } from './jq.module.js';

@Module({
  imports: [JqModule, AjvModule],
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
  ],
  exports: [RuntimeChecks, JqModule, AjvModule],
})
export class RuntimeModule {}
