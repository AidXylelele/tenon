import { Injectable } from '@nestjs/common';
import type { Definition } from '../../../domain/automation/language/definition.js';
import {
  DefinitionReader,
  ExpressionEvaluator,
  SchemaValidator,
} from '../language/ports.js';
import type { CheckDocumentQuery } from './ports.js';

@Injectable()
export class CheckDocument {
  constructor(
    private readonly definitions: DefinitionReader,
    private readonly expressions: ExpressionEvaluator,
    private readonly schemas: SchemaValidator,
  ) {}

  async execute(query: CheckDocumentQuery): Promise<Definition> {
    const definition = this.definitions.read(query.text);
    await this.expressions.check(definition.expressions);
    await this.schemas.check(definition.schemas);
    return definition;
  }
}
