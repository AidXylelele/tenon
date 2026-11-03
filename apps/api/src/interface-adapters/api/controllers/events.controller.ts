import { Can } from '@nestjs/authorization';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
} from '@nestjs/common';
import { ApiAcceptedResponse, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { IncomingHttpHeaders } from 'node:http';
import { AcceptEvent } from '../../../application/automation/events/accept-event.js';
import { EventOrigin } from '../../../application/automation/events/enums.js';
import { InstancePolicy } from '../../../application/automation/instances/instance.policy.js';
import { ProblemFilter } from '../filters/problem.filter.js';
import { CloudEventMapper } from '../mappers/cloud-event.mapper.js';
import { CloudEventBody } from '../schemas/event.schemas.js';

// The intake of CloudEvents from users and applications, in structured or binary mode (FR-023).
// The answer does not wait for any workflow; a duplicate is acknowledged alike.
@ApiTags('events')
@ApiCookieAuth('sessionCookie')
@UseFilters(ProblemFilter)
@Controller('events')
export class EventsController {
  constructor(private readonly acceptEvent: AcceptEvent) {}

  @Post()
  @Can(InstancePolicy, 'operate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse()
  async publish(
    @Headers() headers: IncomingHttpHeaders,
    @Body() body: unknown,
  ): Promise<void> {
    const declared = CloudEventMapper.isBinary(headers)
      ? CloudEventMapper.fromBinary(headers, body)
      : body;
    const parsed = CloudEventBody.safeParse(declared);

    if (!parsed.success) throw new BadRequestException(parsed.error.issues);

    await this.acceptEvent.execute({
      cloudEvent: parsed.data,
      origin: EventOrigin.Intake,
      instanceId: null,
    });
  }
}
