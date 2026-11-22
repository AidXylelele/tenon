import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { AddressPolicy } from "../http-client/address-policy.js";
import { outboundConfig } from "./configs.js";

@Module({
  imports: [ConfigModule.forFeature(outboundConfig)],
  providers: [
    {
      provide: AddressPolicy,
      inject: [outboundConfig.KEY],
      useFactory: (outbound: ConfigType<typeof outboundConfig>) =>
        new AddressPolicy(outbound.OUTBOUND_ALLOW_LIST),
    },
  ],
  exports: [AddressPolicy],
})
export class OutboundModule {}
