import { Can } from "@nestjs/authorization";
import { Controller, Get, Header } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  HostCapabilities,
  HostLimits,
  ProcessPlatform,
} from "../../../application/automation/host/queries.js";
import { HostPresenter } from "../presenters/host.presenter.js";
import { HostProfileResponse } from "../schemas/host.schema.js";

@ApiTags("host")
@ApiCookieAuth("sessionCookie")
@Controller("host-profile")
export class HostController {
  constructor(
    private readonly capabilities: HostCapabilities,
    private readonly platform: ProcessPlatform,
    private readonly limits: HostLimits,
    private readonly hostPresenter: HostPresenter,
  ) {}

  @Get()
  @Can.Anyone()
  @Header("Cache-Control", "private, max-age=3600")
  @ApiOkResponse({
    standardSchema: HostProfileResponse,
    headers: {
      "Cache-Control": {
        description: "The profile may be kept for an hour by this session",
        schema: { type: "string", example: "private, max-age=3600" },
      },
    },
  })
  @ApiUnauthorizedResponse()
  profile(): HostProfileResponse {
    const analysis = this.capabilities.profile();
    const shell = this.platform.shell;
    const events = this.capabilities.lifecycleEvents();
    return this.hostPresenter.profile(analysis, shell, this.limits, events);
  }
}
