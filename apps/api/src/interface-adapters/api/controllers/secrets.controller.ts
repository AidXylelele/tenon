import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
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
  UseFilters,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateSecret } from '../../../application/automation/secrets/create-secret.js';
import { DeleteSecret } from '../../../application/automation/secrets/delete-secret.js';
import { SecretQueries } from '../../../application/automation/secrets/queries.js';
import { ReplaceSecret } from '../../../application/automation/secrets/replace-secret.js';
import { SecretPolicy } from '../../../application/automation/secrets/secret.policy.js';
import type { User } from '../../../domain/identity/user.js';
import { ProblemFilter } from '../filters/problem.filter.js';
import { ProblemPresenter } from '../presenters/problem.presenter.js';
import { SecretPresenter } from '../presenters/secret.presenter.js';
import {
  CreateSecretBody,
  ReplaceSecretBody,
  SecretListResponse,
  SecretParams,
  SecretResponse,
} from '../schemas/secret.schemas.js';

// A user's own secrets, by name (US8, FR-007): a value goes in and never comes back.
@ApiTags('secrets')
@ApiCookieAuth('sessionCookie')
@UseFilters(ProblemFilter)
@Controller('secrets')
export class SecretsController {
  constructor(
    private readonly createSecret: CreateSecret,
    private readonly replaceSecret: ReplaceSecret,
    private readonly deleteSecret: DeleteSecret,
    private readonly secrets: SecretQueries,
  ) {}

  @Get()
  @Can(SecretPolicy, 'manage')
  @ApiOkResponse({ standardSchema: SecretListResponse })
  async list(@CurrentUser() user: User): Promise<SecretListResponse> {
    const views = await this.secrets.list(user.id);
    return SecretPresenter.list(views);
  }

  @Post()
  @Can(SecretPolicy, 'manage')
  @ApiCreatedResponse({ standardSchema: SecretResponse })
  @ApiConflictResponse()
  async create(
    @Body({ schema: CreateSecretBody }) body: CreateSecretBody,
    @CurrentUser() user: User,
  ): Promise<SecretResponse> {
    const created = await this.createSecret.execute({
      ownerId: user.id,
      name: body.name,
      value: body.value,
    });

    if (!created.ok) throw ProblemPresenter.of(created.failure);

    return SecretPresenter.secret(created.value);
  }

  @Put(':name')
  @Can(SecretPolicy, 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
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

    if (!replaced.ok) throw ProblemPresenter.of(replaced.failure);
  }

  @Delete(':name')
  @Can(SecretPolicy, 'manage')
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

    if (!deleted.ok) throw ProblemPresenter.of(deleted.failure);
  }
}
