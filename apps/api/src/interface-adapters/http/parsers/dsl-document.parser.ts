import {
  createParamDecorator,
  type ExecutionContext,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { DocumentFormat } from '../../../domain/automation/workflows/interfaces.js';

const FORMATS: Readonly<Record<string, DocumentFormat>> = {
  'application/json': 'json',
  'application/yaml': 'yaml',
  'application/x-yaml': 'yaml',
  'text/yaml': 'yaml',
};

const MEDIA_TYPES: Readonly<Record<DocumentFormat, string>> = {
  json: 'application/json',
  yaml: 'application/yaml',
};

export const DOCUMENT_MEDIA_TYPES = Object.keys(FORMATS);

export const DOCUMENT_LIMIT = '1mb';

export const DOCUMENT_ROUTES = ['/workflows', '/workflows/check'];

export interface SubmittedDocument {
  readonly format: DocumentFormat;
  readonly text: string;
}

export function mediaTypeOf(format: DocumentFormat): string {
  return MEDIA_TYPES[format];
}

export const DslDocument = createParamDecorator(
  (_: unknown, context: ExecutionContext): SubmittedDocument => {
    const request = context.switchToHttp().getRequest<Request>();
    const contentType = request.headers['content-type'] ?? '';
    const mediaType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
    const format = FORMATS[mediaType];
    const body: unknown = request.body;

    if (format === undefined || typeof body !== 'string')
      throw new UnsupportedMediaTypeException(
        'Send the document as application/yaml or application/json',
      );

    return { format, text: body };
  },
);
