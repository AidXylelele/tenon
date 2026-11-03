import { Module } from '@nestjs/common';
import { JsonSchemaClient } from '../runtime/interfaces.js';
import { AjvJsonSchemaClient } from '../ajv/ajv-json-schema.client.js';

@Module({
  providers: [
    AjvJsonSchemaClient,
    { provide: JsonSchemaClient, useExisting: AjvJsonSchemaClient },
  ],
  exports: [JsonSchemaClient],
})
export class AjvModule {}
