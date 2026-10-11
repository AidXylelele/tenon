import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { createHttpLoggerOptions } from '../pino/http-logger.js';
import type { Env } from './config.module.js';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: createHttpLoggerOptions(
          config.get('LOG_LEVEL', { infer: true }),
          config.get('NODE_ENV', { infer: true }) === 'development',
        ),
      }),
    }),
  ],
})
export class LoggingModule {}
