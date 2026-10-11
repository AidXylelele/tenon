import { inject } from 'vitest';

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: inject('DATABASE_URL'),
  WEB_BASE_URL: 'http://127.0.0.1:3001',
  TRUSTED_ORIGINS: 'http://127.0.0.1:3001',
  TRUSTED_PROXIES: '127.0.0.1',
  SESSION_COOKIE_SECURE: 'false',
  OUTBOX_RELAY: 'off',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '2525',
  SMTP_STARTTLS: 'never',
  SMTP_USER: '',
  SMTP_PASSWORD: '',
  SMTP_FROM: 'Workflow Platform <no-reply@test.local>',
  LOG_LEVEL: 'silent',
});
