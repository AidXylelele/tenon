import type {
  NodeSampleView,
  Page,
  SavedDraft,
  WorkflowDetails,
  WorkflowSummary,
} from '../../../application/interfaces.js';
import type {
  NodeSampleResponse,
  SavedDraftResponse,
  WorkflowPageResponse,
  WorkflowResponse,
  WorkflowSummaryResponse,
} from '../dto/automation-responses.dto.js';
import { GraphPresenter } from './graph.presenter.js';

export class WorkflowPresenter {
  static summary(summary: WorkflowSummary): WorkflowSummaryResponse {
    return {
      id: summary.id,
      name: summary.name,
      owner: { id: summary.owner.id, name: summary.owner.name },
      archived: summary.archived,
      latestRelease: summary.latestRelease,
      activeRelease: summary.activeRelease,
      updatedAt: summary.updatedAt,
    };
  }

  static page(page: Page<WorkflowSummary>): WorkflowPageResponse {
    return {
      items: page.items.map((summary) => WorkflowPresenter.summary(summary)),
      nextCursor: page.nextCursor,
    };
  }

  static details(details: WorkflowDetails): WorkflowResponse {
    const { workflow } = details;
    return {
      ...WorkflowPresenter.summary(workflow),
      canManage: details.canManage,
      draft: {
        revision: workflow.revision,
        graph: GraphPresenter.graph(workflow.graph),
        settings: GraphPresenter.settings(workflow.settings),
        problems: [...details.problems],
      },
      samples: workflow.samples.map((sample) =>
        WorkflowPresenter.sample(sample),
      ),
    };
  }

  static sample(sample: NodeSampleView): NodeSampleResponse {
    return {
      nodeId: sample.nodeId,
      pinned: sample.pinned,
      fields: [...sample.fields],
    };
  }

  static saved(saved: SavedDraft): SavedDraftResponse {
    return {
      revision: saved.workflow.revision,
      problems: [...saved.problems],
    };
  }
}
