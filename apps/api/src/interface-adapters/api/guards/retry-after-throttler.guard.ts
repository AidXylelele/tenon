import { type ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard, type ThrottlerLimitDetail } from "@nestjs/throttler";

@Injectable()
export class RetryAfterThrottlerGuard extends ThrottlerGuard {
  private static readonly RETRY_AFTER = "Retry-After";

  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { res } = this.getRequestResponse(context);
    this.setResponseHeader(
      res,
      RetryAfterThrottlerGuard.RETRY_AFTER,
      detail.timeToBlockExpire,
    );
    await super.throwThrottlingException(context, detail);
  }
}
