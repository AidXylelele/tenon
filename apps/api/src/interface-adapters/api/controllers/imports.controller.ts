import { AutomationPolicy } from "../auth/automation.policy.js";
import { Can } from "@nestjs/authorization";
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import {
  ApiBadGatewayResponse,
  ApiCookieAuth,
  ApiGatewayTimeoutResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { FetchImport } from "../../../application/automation/imports/fetch-import.js";
import { ImportPresenter } from "../presenters/import.presenter.js";
import {
  FetchImportBody,
  ImportTextResponse,
} from "../schemas/import.schemas.js";

@ApiTags("imports")
@ApiCookieAuth("sessionCookie")
@Controller("imports")
export class ImportsController {
  constructor(
    private readonly fetchImport: FetchImport,
    private readonly importPresenter: ImportPresenter,
  ) {}

  @Post("fetch")
  @Can(AutomationPolicy, "change")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ standardSchema: ImportTextResponse })
  @ApiUnprocessableEntityResponse()
  @ApiBadGatewayResponse()
  @ApiGatewayTimeoutResponse()
  async fetch(
    @Body({ schema: FetchImportBody }) body: FetchImportBody,
  ): Promise<ImportTextResponse> {
    const fetched = await this.fetchImport.execute({ uri: body.uri });

    if (!fetched.ok) throw this.importPresenter.refusalOf(fetched.failure);

    return this.importPresenter.text(fetched.value);
  }
}
