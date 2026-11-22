import { AutomationPolicy } from "../auth/automation.policy.js";
import { CurrentUser } from "@nestjs/authentication";
import { Can } from "@nestjs/authorization";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { CreateSecret } from "../../../application/automation/secrets/create-secret.js";
import { DeleteSecret } from "../../../application/automation/secrets/delete-secret.js";
import { SecretQueries } from "../../../application/automation/secrets/queries.js";
import { ReplaceSecret } from "../../../application/automation/secrets/replace-secret.js";
import type { User } from "../../../domain/identity/user.js";
import { ProblemPresenter } from "../presenters/problem.presenter.js";
import { SecretPresenter } from "../presenters/secret.presenter.js";
import {
  CreateSecretBody,
  ReplaceSecretBody,
  SecretListResponse,
  SecretParams,
  SecretResponse,
} from "../schemas/secret.schemas.js";

@ApiTags("secrets")
@ApiCookieAuth("sessionCookie")
@Controller("secrets")
export class SecretsController {
  constructor(
    private readonly createSecret: CreateSecret,
    private readonly replaceSecret: ReplaceSecret,
    private readonly deleteSecret: DeleteSecret,
    private readonly secrets: SecretQueries,
    private readonly secretPresenter: SecretPresenter,
    private readonly problemPresenter: ProblemPresenter,
  ) {}

  @Get()
  @Can(AutomationPolicy, "change")
  @ApiOkResponse({ standardSchema: SecretListResponse })
  async list(@CurrentUser() user: User): Promise<SecretListResponse> {
    const views = await this.secrets.list(user.id);
    return this.secretPresenter.list(views);
  }

  @Post()
  @Can(AutomationPolicy, "change")
  @ApiCreatedResponse({ standardSchema: SecretResponse })
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  async create(
    @Body({ schema: CreateSecretBody }) body: CreateSecretBody,
    @CurrentUser() user: User,
  ): Promise<SecretResponse> {
    const created = await this.createSecret.execute({
      ownerId: user.id,
      name: body.name,
      value: body.value,
    });

    if (!created.ok) throw this.problemPresenter.of(created.failure);

    return this.secretPresenter.secret(created.value);
  }

  @Put(":name")
  @Can(AutomationPolicy, "change")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse()
  async replace(
    @Param({ schema: SecretParams }) params: SecretParams,
    @Body({ schema: ReplaceSecretBody }) body: ReplaceSecretBody,
    @CurrentUser() user: User,
  ): Promise<void> {
    const replaced = await this.replaceSecret.execute({
      ownerId: user.id,
      name: params.name,
      value: body.value,
    });

    if (!replaced.ok) throw this.problemPresenter.of(replaced.failure);
  }

  @Delete(":name")
  @Can(AutomationPolicy, "change")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async delete(
    @Param({ schema: SecretParams }) params: SecretParams,
    @CurrentUser() user: User,
  ): Promise<void> {
    const deleted = await this.deleteSecret.execute({
      ownerId: user.id,
      name: params.name,
    });

    if (!deleted.ok) throw this.problemPresenter.of(deleted.failure);
  }
}
