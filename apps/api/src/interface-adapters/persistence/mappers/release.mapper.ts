import { Release } from '../../../domain/release.js';
import type { ReleaseRow } from '../../interfaces.js';
import { GraphMapper } from './graph.mapper.js';

export class ReleaseMapper {
  static toRow(release: Release): ReleaseRow {
    return {
      workflowId: release.workflowId,
      number: release.number,
      graph: GraphMapper.toProps(release.graph),
      settings: release.settings,
      credentialIds: release.credentialIds,
      publishedAt: release.publishedAt,
      publishedBy: release.publishedBy,
    };
  }

  static toEntity(row: ReleaseRow): Release {
    const graph = GraphMapper.toGraph(row.graph);
    return new Release({
      workflowId: row.workflowId,
      number: row.number,
      graph,
      settings: row.settings,
      publishedAt: row.publishedAt,
      publishedBy: row.publishedBy,
    });
  }
}
