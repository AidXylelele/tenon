import { type Span, SpanStatusCode } from "@opentelemetry/api";
import { attributeKeys } from "./names.js";

const otherError = "_OTHER";

export function errorTypeOf(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }

  return otherError;
}

export function failed(span: Span, error: unknown): void {
  const type = errorTypeOf(error);
  span.setAttribute(attributeKeys.errorType, type);

  if (!(error instanceof Error)) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    return;
  }

  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
}
