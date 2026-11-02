import {
  createParamDecorator,
  type ExecutionContext,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DocumentFormat } from '../../../domain/automation/workflows/enums.js';
import { DocumentMediaType } from '../enums.js';

export interface DocumentBody {
  readonly format: DocumentFormat;
  readonly text: string;
}

export const DocumentBody = createParamDecorator(
  (_: unknown, context: ExecutionContext): DocumentBody => {
    const request = context.switchToHttp().getRequest<Request>();
    const contentType = request.headers['content-type'] ?? '';
    const essence = contentType.split(';')[0] ?? '';
    const declared = essence.trim().toLowerCase();
    const mediaTypes = Object.values(DocumentMediaType);
    const mediaType = mediaTypes.find((value: string) => value === declared);
    const body: unknown = request.body;

    if (mediaType === undefined || typeof body !== 'string')
      throw new UnsupportedMediaTypeException(
        'Send the document as application/yaml or application/json',
      );

    if (mediaType === DocumentMediaType.Json)
      return { format: DocumentFormat.Json, text: body };

    return { format: DocumentFormat.Yaml, text: body };
  },
);
