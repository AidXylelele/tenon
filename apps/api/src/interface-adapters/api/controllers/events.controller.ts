import { AutomationPolicy } from "../auth/automation.policy.js";
import { Can } from "@nestjs/authorization";
import { Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiCookieAuth,
  ApiTags,
  ApiTooManyRequestsResponse,
} from "@nestjs/swagger";
import { minutes, Throttle } from "@nestjs/throttler";
import { AcceptEvent } from "../../../application/automation/events/accept-event.js";
import { EventOrigin } from "../../../application/automation/events/enums.js";
import { ReceivedCloudEvent } from "../pipeline/received-cloud-event.decorator.js";
import { CloudEventBody } from "../schemas/event.schema.js";

@ApiTags("events")
@ApiCookieAuth("sessionCookie")
@Controller("events")
export class EventsController {
  constructor(private readonly acceptEvent: AcceptEvent) {}

  @Post()
  @Can(AutomationPolicy, "change")
  @Throttle({ default: { limit: 300, ttl: minutes(1) } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse()
  @ApiTooManyRequestsResponse()
  async publish(
    @ReceivedCloudEvent({ schema: CloudEventBody }) cloudEvent: CloudEventBody,
  ): Promise<void> {
    await this.acceptEvent.execute({
      cloudEvent,
      origin: EventOrigin.Intake,
      instanceId: null,
    });
  }
}
