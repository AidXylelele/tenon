import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { z } from 'zod';

const list = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );

const optional = z
  .string()
  .default('')
  .transform((value) => (value.length > 0 ? value : undefined));

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  WEB_BASE_URL: z.url(),
  TRUSTED_ORIGINS: list,
  TRUSTED_PROXIES: list,
  SESSION_COOKIE_SECURE: z.stringbool().default(true),
  OUTBOX_RELAY: z.enum(['on', 'off']).default('on'),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_STARTTLS: z
    .enum(['required', 'opportunistic', 'never'])
    .default('required'),
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
  SMTP_FROM: z.string().min(1),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),
});

export type Env = z.infer<typeof envSchema>;

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (config) => envSchema.parse(config),
    }),
  ],
})
export class ConfigModule {}
