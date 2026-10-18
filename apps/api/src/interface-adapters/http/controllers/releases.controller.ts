import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Transactional } from '@nestjs-cls/transactional';
import { GetRelease } from '../../../application/use-cases/get-release.js';
import { ListReleases } from '../../../application/use-cases/list-releases.js';
import { PublishRelease } from '../../../application/use-cases/publish-release.js';
import type { User } from '../../../domain/user.js';
import {
  ReleaseListResponse,
  ReleaseResponse,
  ReleaseSummaryResponse,
} from '../dto/automation-responses.dto.js';
import { RevisionDto } from '../dto/revision.dto.js';
import { ReleasePresenter } from '../presenters/release.presenter.js';

@ApiTags('workflows')
@ApiCookieAuth('sessionCookie')
@Controller('workflows/:id/releases')
export class ReleasesController {
  constructor(
    private readonly publishRelease: PublishRelease,
    private readonly listReleases: ListReleases,
    private readonly getRelease: GetRelease,
  ) {}

  @Get()
  @Can.Anyone()
  @ApiOkResponse({ type: ReleaseListResponse })
  @ApiNotFoundResponse()
  async list(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReleaseListResponse> {
    const releases = await this.listReleases.execute(id);
    return ReleasePresenter.list(releases);
  }

  @Post()
  @Can.Anyone()
  @Transactional()
  @HttpCode(201)
  @ApiCreatedResponse({ type: ReleaseSummaryResponse })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse({
    description: 'Nodes have configuration problems; `problems` lists them',
  })
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisionDto,
    @CurrentUser() user: User,
  ): Promise<ReleaseSummaryResponse> {
    const release = await this.publishRelease.execute({
      actor: user,
      workflowId: id,
      revision: dto.revision,
    });
    return ReleasePresenter.published(release, user);
  }

  @Get(':number')
  @Can.Anyone()
  @ApiOkResponse({ type: ReleaseResponse })
  @ApiNotFoundResponse()
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('number', ParseIntPipe) number: number,
    @CurrentUser() user: User,
  ): Promise<ReleaseResponse> {
    const release = await this.getRelease.execute({
      actor: user,
      workflowId: id,
      number,
    });
    return ReleasePresenter.release(release);
  }
}
