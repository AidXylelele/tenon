import {
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import {
  ArtifactStore,
  type Item,
  type OutputTarget,
} from '../../application/interfaces.js';
import { StorageUnavailableError } from '../../domain/errors.js';
import type { StepOutput } from '../../domain/interfaces.js';

interface Chunk {
  readonly lines: string[];
  bytes: number;
}

export class S3ArtifactStore extends ArtifactStore {
  static readonly CHUNK_ITEMS = 500;
  static readonly CHUNK_BYTES = 4 * 1024 * 1024;

  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {
    super();
  }

  async write(
    target: OutputTarget,
    items: readonly Item[],
  ): Promise<StepOutput> {
    const key = `runs/${target.runId}/nodes/${target.nodeId}/a${target.attempt}/${target.port}`;
    const chunks = S3ArtifactStore.chunksOf(items);
    const chunkStarts: number[] = [];
    let start = 0;
    let bytes = 0;

    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index]!;
      const body = chunk.lines.join('\n');
      await this.put(`${key}/${index}.jsonl`, body);
      chunkStarts.push(start);
      start += chunk.lines.length;
      bytes += chunk.bytes;
    }

    return { port: target.port, items: items.length, bytes, key, chunkStarts };
  }

  async read(
    outputs: readonly StepOutput[],
    offset: number,
    limit: number,
  ): Promise<Item[]> {
    const items: Item[] = [];
    let skipped = 0;

    for (const output of outputs) {
      if (items.length >= limit) break;

      const end = skipped + output.items;

      if (end <= offset) {
        skipped += output.items;
        continue;
      }

      const outputOffset = offset - skipped;
      const from = Math.max(outputOffset, 0);
      const wanted = limit - items.length;
      const segment = await this.readSegment(output, from, wanted);
      items.push(...segment);
      skipped += output.items;
    }

    return items;
  }

  async readAll(outputs: readonly StepOutput[]): Promise<Item[]> {
    const items: Item[] = [];

    for (const output of outputs) {
      const segment = await this.readSegment(output, 0, output.items);
      items.push(...segment);
    }

    return items;
  }

  private async readSegment(
    output: StepOutput,
    from: number,
    count: number,
  ): Promise<Item[]> {
    const items: Item[] = [];

    for (let index = 0; index < output.chunkStarts.length; index++) {
      const start = output.chunkStarts[index]!;
      const end = output.chunkStarts[index + 1] ?? output.items;

      if (end <= from || items.length >= count) continue;

      const chunk = await this.get(`${output.key}/${index}.jsonl`);
      const lines = chunk.split('\n');
      const chunkOffset = from - start;
      const first = Math.max(chunkOffset, 0);

      for (let line = first; line < lines.length; line++) {
        if (items.length >= count) break;

        const item = JSON.parse(lines[line]!) as Item;
        items.push(item);
      }
    }

    return items;
  }

  private async put(key: string, body: string): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'application/x-ndjson',
      });
      await this.client.send(command);
    } catch {
      throw new StorageUnavailableError();
    }
  }

  private async get(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      const response = await this.client.send(command);
      const text = await response.Body?.transformToString('utf8');
      return text ?? '';
    } catch {
      throw new StorageUnavailableError();
    }
  }

  private static chunksOf(items: readonly Item[]): Chunk[] {
    const chunks: Chunk[] = [];
    let current: Chunk = { lines: [], bytes: 0 };

    for (const item of items) {
      const line = JSON.stringify(item);
      const size = Buffer.byteLength(line) + 1;
      const full =
        current.lines.length >= S3ArtifactStore.CHUNK_ITEMS ||
        current.bytes + size > S3ArtifactStore.CHUNK_BYTES;

      if (full && current.lines.length > 0) {
        chunks.push(current);
        current = { lines: [], bytes: 0 };
      }

      current.lines.push(line);
      current.bytes += size;
    }

    if (current.lines.length > 0) chunks.push(current);

    return chunks;
  }
}
