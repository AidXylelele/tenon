import { Workflow } from '../../../domain/workflow.js';
import type { WorkflowRow } from '../../interfaces.js';
import { GraphMapper } from './graph.mapper.js';

export class WorkflowMapper {
  static toRow(workflow: Workflow): WorkflowRow {
    return {
      id: workflow.id,
      name: workflow.name,
      ownerId: workflow.ownerId,
      graph: GraphMapper.toProps(workflow.graph),
      settings: workflow.settings,
      revision: workflow.revision,
      pinnedNodeIds: [...workflow.pinnedNodeIds],
      latestRelease: workflow.latestRelease,
      activeRelease: workflow.activeRelease,
      archivedAt: workflow.archivedAt,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      version: workflow.version,
    };
  }

  static toEntity(row: WorkflowRow): Workflow {
    const graph = GraphMapper.toGraph(row.graph);
    return new Workflow({
      id: row.id,
      name: row.name,
      ownerId: row.ownerId,
      graph,
      settings: row.settings,
      revision: row.revision,
      pinnedNodeIds: row.pinnedNodeIds,
      latestRelease: row.latestRelease,
      activeRelease: row.activeRelease,
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    });
  }
}
