import { Can } from "@nestjs/authorization";
import { Controller, Get } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { MemberQueries } from "../../../application/identity/users/queries.js";
import { InvitationPolicy } from "../auth/invitation.policy.js";
import { UserPresenter } from "../presenters/user.presenter.js";
import { MemberListResponse } from "../schemas/member.schema.js";

@ApiTags("members")
@ApiCookieAuth("sessionCookie")
@Controller("members")
export class MembersController {
  constructor(
    private readonly members: MemberQueries,
    private readonly userPresenter: UserPresenter,
  ) {}

  @Get()
  @Can(InvitationPolicy, "manage")
  @ApiOkResponse({ standardSchema: MemberListResponse })
  async list(): Promise<MemberListResponse> {
    const members = await this.members.list();
    return this.userPresenter.members(members);
  }
}
