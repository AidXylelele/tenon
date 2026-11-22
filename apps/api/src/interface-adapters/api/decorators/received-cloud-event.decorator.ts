import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { IncomingHttpHeaders } from "node:http";
import type { CloudEvent } from "../../../application/automation/events/interfaces.js";
import type { JsonValue } from "../../../domain/automation/interfaces.js";

const PREFIX = "ce-";
const SPEC_VERSION = "ce-specversion";

export const ReceivedCloudEvent = createParamDecorator(cloudEventOf);

function cloudEventOf(_data: unknown, context: ExecutionContext): unknown {
  const request = context.switchToHttp().getRequest<Request>();
  const body: unknown = request.body;

  if (request.headers[SPEC_VERSION] === undefined) return body;

  return fromBinary(request.headers, body);
}

function fromBinary(headers: IncomingHttpHeaders, body: unknown): CloudEvent {
  const event: Record<string, JsonValue> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (!name.startsWith(PREFIX) || typeof value !== "string") continue;

    const attribute = name.slice(PREFIX.length);
    event[attribute] = decodeURIComponent(value);
  }

  const type = headers["content-type"];

  if (type !== undefined) event.datacontenttype = type;

  const data = dataOf(body);

  if (data !== null) event.data = data;

  return event;
}

function dataOf(body: unknown): JsonValue {
  if (body === undefined || body === null) return null;

  if (typeof body === "string") return body.length === 0 ? null : body;

  return body as JsonValue;
}
