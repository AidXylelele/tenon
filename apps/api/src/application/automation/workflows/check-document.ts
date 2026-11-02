import { Injectable } from '@nestjs/common';
import { SourceDocument } from '../../../domain/automation/workflows/source-document.js';
import {
  DefinitionReader,
  ExpressionEvaluator,
  SchemaValidator,
} from '../language/ports.js';
import {
  type CheckDocumentQuery,
  type CheckedDocument,
  WorkflowVersionRepository,
} from './ports.js';

// Everything publishing checks, so checking a document gives the outcome publishing would.
@Injectable()
export class CheckDocument {
  constructor(
    private readonly definitions: DefinitionReader,
    private readonly expressions: ExpressionEvaluator,
    private readonly schemas: SchemaValidator,
    private readonly versions: WorkflowVersionRepository,
  ) {}

  async execute(query: CheckDocumentQuery): Promise<CheckedDocument> {
    const source = new SourceDocument({
      format: query.format,
      text: query.text,
    });
    const definition = await this.definitions.read(source);
    await this.expressions.check(definition.expressions);
    await this.schemas.check(definition.schemas);
    const existing = await this.versions.find(
      definition.workflow,
      definition.version,
    );

    if (existing !== null) existing.confirmSame(source);

    return { source, definition, existing };
  }
}
