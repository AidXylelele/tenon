import { fileURLToPath } from 'node:url';
import { GenericContainer, Wait } from 'testcontainers';

export const STORAGE_BUCKET = 'runs';
export const STORAGE_ACCESS_KEY = 'GK00000000000000000000000a';
export const STORAGE_SECRET_KEY =
  '000000000000000000000000000000000000000000000000000000000000000a';

const GARAGE_IMAGE =
  'dxflrs/garage:v2.4.1@sha256:9c96caa2612d3411acc5b0e6701fb238dbfba33e533a6d7d3d811a4b12d0d020';

export interface ObjectStorage {
  readonly endpoint: string;
  stop(): Promise<void>;
}

export async function startObjectStorage(): Promise<ObjectStorage> {
  const config = fileURLToPath(
    new URL('../../../../infra/garage/garage.toml', import.meta.url),
  );
  const container = await new GenericContainer(GARAGE_IMAGE)
    .withCopyFilesToContainer([{ source: config, target: '/etc/garage.toml' }])
    .withEnvironment({
      GARAGE_RPC_SECRET:
        '1111111111111111111111111111111111111111111111111111111111111111',
      GARAGE_DEFAULT_ACCESS_KEY: STORAGE_ACCESS_KEY,
      GARAGE_DEFAULT_SECRET_KEY: STORAGE_SECRET_KEY,
      GARAGE_DEFAULT_BUCKET: STORAGE_BUCKET,
    })
    .withCommand(['/garage', 'server', '--single-node', '--default-bucket'])
    .withExposedPorts(3900)
    .withWaitStrategy(Wait.forLogMessage('S3 API server listening'))
    .start();
  return {
    endpoint: `http://${container.getHost()}:${container.getMappedPort(3900)}`,
    stop: async () => {
      await container.stop();
    },
  };
}
