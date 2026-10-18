import { Can } from '@nestjs/authorization';
import { Controller, Get, Header } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListNodeTypes } from '../../../application/use-cases/list-node-types.js';
import { CatalogueResponse } from '../dto/automation-responses.dto.js';
import { NodeTypePresenter } from '../presenters/node-type.presenter.js';

@ApiTags('catalogue')
@ApiCookieAuth('sessionCookie')
@Controller('node-types')
export class NodeTypesController {
  constructor(private readonly listNodeTypes: ListNodeTypes) {}

  @Get()
  @Can.Anyone()
  @Header('Cache-Control', 'no-cache')
  @ApiOkResponse({ type: CatalogueResponse })
  list(): CatalogueResponse {
    const types = this.listNodeTypes.execute();
    return NodeTypePresenter.catalogue(types);
  }
}
