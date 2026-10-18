import { S3Client } from '@aws-sdk/client-s3';
import type { Env } from '../di/config.module.js';

export function createS3Client(
  config: Pick<
    Env,
    | 'STORAGE_ENDPOINT'
    | 'STORAGE_REGION'
    | 'STORAGE_ACCESS_KEY'
    | 'STORAGE_SECRET_KEY'
  >,
): S3Client {
  return new S3Client({
    endpoint: config.STORAGE_ENDPOINT,
    region: config.STORAGE_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.STORAGE_ACCESS_KEY,
      secretAccessKey: config.STORAGE_SECRET_KEY,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}
