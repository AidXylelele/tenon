import { Injectable } from '@nestjs/common';
import type { Report } from '../../../domain/automation/language/report.js';
import { SourceDocument } from '../../../domain/automation/workflows/source-document.js';
import { ExpressionEvaluator } from '../language/ports.js';
import { type CheckDocumentQuery, DocumentReader } from './ports.js';
import { WorkflowQueries } from './queries.js';

@Injectable()
export class CheckDocument {
  constructor(
    private readonly reader: DocumentReader,
    private readonly expressions: ExpressionEvaluator,
    private readonly workflows: WorkflowQueries,
  ) {}

  async execute(query: CheckDocumentQuery): Promise<Report> {
    const source = SourceDocument.of(query.format, query.text);
    const reading = this.reader.read(source);
    const build = reading.build();
    const expressionProblems = await this.expressions.check(build.expressions);
    const published = await this.workflows.referenceFacts(build.targets);
    return build.report(expressionProblems, published);
  }
}
