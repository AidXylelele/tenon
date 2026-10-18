import { createS3Client } from '../../../src/frameworks/s3/client.js';
import { S3ArtifactStore } from '../../../src/interface-adapters/storage/s3-artifact.store.js';

const store = () =>
  new S3ArtifactStore(
    createS3Client({
      STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT!,
      STORAGE_REGION: process.env.STORAGE_REGION!,
      STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY!,
      STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY!,
    }),
    process.env.STORAGE_BUCKET!,
  );

const items = (count: number, from = 0) =>
  Array.from({ length: count }, (_, index) => ({ n: from + index }));

describe('S3ArtifactStore', () => {
  it('a_large_output_is_stored_in_chunks_of_five_hundred_items_and_read_back_whole', async () => {
    const artifacts = store();
    const target = {
      runId: crypto.randomUUID(),
      nodeId: 'a',
      attempt: 1,
      port: 'main',
    };
    const output = await artifacts.write(target, items(1_200));
    expect(output).toMatchObject({
      port: 'main',
      items: 1_200,
      key: `runs/${target.runId}/nodes/a/a1/main`,
      chunkStarts: [0, 500, 1_000],
    });
    expect(output.bytes).toBeGreaterThan(0);
    expect(await artifacts.readAll([output])).toEqual(items(1_200));
  });

  it('a_page_is_read_across_chunk_and_segment_boundaries_in_production_order', async () => {
    const artifacts = store();
    const runId = crypto.randomUUID();
    const first = await artifacts.write(
      { runId, nodeId: 'a', attempt: 1, port: 'main' },
      items(600),
    );
    const second = await artifacts.write(
      { runId, nodeId: 'b', attempt: 1, port: 'main' },
      items(50, 600),
    );
    expect(await artifacts.read([first, second], 495, 10)).toEqual(
      items(10, 495),
    );
    expect(await artifacts.read([first, second], 590, 20)).toEqual(
      items(20, 590),
    );
    expect(await artifacts.read([first, second], 640, 100)).toEqual(
      items(10, 640),
    );
    expect(await artifacts.read([first, second], 700, 10)).toEqual([]);
  });

  it('an_empty_output_stores_nothing_and_reads_as_empty', async () => {
    const artifacts = store();
    const output = await artifacts.write(
      { runId: crypto.randomUUID(), nodeId: 'a', attempt: 1, port: 'main' },
      [],
    );
    expect(output).toMatchObject({ items: 0, bytes: 0, chunkStarts: [] });
    expect(await artifacts.readAll([output])).toEqual([]);
  });
});
