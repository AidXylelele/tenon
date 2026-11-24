import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { AddressPolicy } from "../http/address-policy.js";
import { ResponseSizeLimit } from "../http/response-size-limit.js";
import { outboundConfig } from "./configs.js";
import { responseSizeLimit } from "./host.presets.js";

@Module({
  imports: [ConfigModule.forFeature(outboundConfig)],
  providers: [
    {
      provide: AddressPolicy,
      inject: [outboundConfig.KEY],
      useFactory: (outbound: ConfigType<typeof outboundConfig>) =>
        new AddressPolicy(outbound.OUTBOUND_ALLOW_LIST),
    },
    { provide: ResponseSizeLimit, useValue: responseSizeLimit },
  ],
  exports: [AddressPolicy, ResponseSizeLimit],
})
export class OutboundModule {}
