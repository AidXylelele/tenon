import { TriggerType } from '../../domain/enums.js';
import { Graph } from '../../domain/graph.js';
import type {
  ActiveSchedule,
  NodeTypeCatalog,
  WorkflowQueries,
} from '../interfaces.js';

export class ListActiveSchedules {
  constructor(
    private readonly workflows: WorkflowQueries,
    private readonly catalogue: NodeTypeCatalog,
  ) {}

  async execute(workflowId: string): Promise<ActiveSchedule[]> {
    const workflow = await this.workflows.get(workflowId);

    if (workflow.archived || workflow.activeRelease === null) return [];

    const release = await this.workflows.release(
      workflowId,
      workflow.activeRelease,
    );
    const graph = new Graph(release.graph);
    const schedules: ActiveSchedule[] = [];

    for (const node of graph.triggersOf(TriggerType.Schedule)) {
      if (node.disabled) continue;

      const recurrences = this.catalogue.schedulesOf(node);

      for (let rule = 0; rule < recurrences.length; rule++) {
        const recurrence = recurrences[rule]!;
        const timezone = recurrence.timezone ?? release.settings.timezone;
        schedules.push({
          workflowId,
          releaseNumber: release.number,
          nodeId: node.id,
          rule,
          kind: recurrence.kind,
          expression: recurrence.expression,
          timezone,
        });
      }
    }

    return schedules;
  }
}
