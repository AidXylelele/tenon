import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AddressPolicy } from "../http-client/address-policy.js";
import type { Env } from "./env.schema.js";

@Module({
  providers: [
    {
      provide: AddressPolicy,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new AddressPolicy(config.get("OUTBOUND_ALLOW_LIST", { infer: true })),
    },
  ],
  exports: [AddressPolicy],
})
export class OutboundModule {}
