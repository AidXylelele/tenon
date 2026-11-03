import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cipher } from '../../interface-adapters/persistence/interfaces.js';
import { AesGcmCipher } from '../crypto/aes-gcm.cipher.js';
import type { Env } from './config.module.js';

// The cipher that seals secrets at rest, with the platform's SECRETS_KEY.
@Module({
  providers: [
    {
      provide: Cipher,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new AesGcmCipher(config.get('SECRETS_KEY', { infer: true })),
    },
  ],
  exports: [Cipher],
})
export class CryptoModule {}
