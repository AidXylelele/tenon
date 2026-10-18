import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq } from 'drizzle-orm';
import type { ReleaseRepository } from '../../../application/interfaces.js';
import {
  ReleaseConflictError,
  ReleaseNotFoundError,
} from '../../../domain/errors.js';
import type { Release } from '../../../domain/release.js';
import type { DrizzleTx } from '../../interfaces.js';
import { ReleaseMapper } from '../mappers/release.mapper.js';
import { release as releases } from '../schema/index.js';

@Injectable()
export class DrizzleReleaseRepository implements ReleaseRepository {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async add(release: Release): Promise<void> {
    const row = ReleaseMapper.toRow(release);
    const inserted = await this.txHost.tx
      .insert(releases)
      .values(row)
      .onConflictDoNothing()
      .returning({ number: releases.number });

    if (inserted.length === 0) throw new ReleaseConflictError();
  }

  async get(workflowId: string, number: number): Promise<Release> {
    const [row] = await this.txHost.tx
      .select()
      .from(releases)
      .where(
        and(eq(releases.workflowId, workflowId), eq(releases.number, number)),
      );

    if (!row) throw new ReleaseNotFoundError();

    return ReleaseMapper.toEntity(row);
  }
}
