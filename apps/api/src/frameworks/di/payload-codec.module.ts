import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { AesGcmPayloadCodec } from "@nestjs/workflows";
import { secretsConfig } from "./configs.js";

@Module({
  imports: [ConfigModule.forFeature(secretsConfig)],
  providers: [
    {
      provide: AesGcmPayloadCodec,
      inject: [secretsConfig.KEY],
      useFactory: (secrets: ConfigType<typeof secretsConfig>) =>
        new AesGcmPayloadCodec({
          keys: { v1: secrets.SECRETS_KEY },
          current: "v1",
        }),
    },
  ],
  exports: [AesGcmPayloadCodec],
})
export class PayloadCodecModule {}
