import { Injectable } from '@nestjs/common';
import { load } from 'js-yaml';
import { DocumentReader } from '../../application/automation/workflows/ports.js';
import { DocumentReading } from '../../domain/automation/language/document-reading.js';
import { Problem } from '../../domain/automation/language/problem.js';
import type { SourceDocument } from '../../domain/automation/workflows/source-document.js';
import { DslSchema } from '../interfaces.js';
import { SchemaProblems } from './schema-problems.js';

@Injectable()
export class DslDocumentReader implements DocumentReader {
  constructor(private readonly schema: DslSchema) {}

  read(source: SourceDocument): DocumentReading {
    const model = this.#parse(source.text);

    if (model instanceof Problem) return new DocumentReading(null, [model]);

    const valid = this.schema.validate(model);

    if (valid) return new DocumentReading(model, []);

    const errors = this.schema.validate.errors ?? [];
    const problems = new SchemaProblems(model, errors).located();
    return new DocumentReading(null, problems);
  }

  #parse(text: string): unknown {
    try {
      return load(text);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown failure';
      const firstLine = detail.split('\n')[0] ?? detail;
      return new Problem('', `The document cannot be parsed: ${firstLine}`);
    }
  }
}
