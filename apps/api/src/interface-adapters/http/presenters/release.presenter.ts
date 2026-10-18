import type {
  ReleaseSummary,
  ReleaseView,
} from '../../../application/interfaces.js';
import type { Release } from '../../../domain/release.js';
import type { User } from '../../../domain/user.js';
import type {
  ReleaseListResponse,
  ReleaseResponse,
  ReleaseSummaryResponse,
} from '../dto/automation-responses.dto.js';
import { GraphPresenter } from './graph.presenter.js';

export class ReleasePresenter {
  static published(release: Release, publisher: User): ReleaseSummaryResponse {
    return {
      number: release.number,
      publishedAt: release.publishedAt,
      publishedBy: { id: publisher.id, name: publisher.name },
    };
  }

  static summary(release: ReleaseSummary): ReleaseSummaryResponse {
    return {
      number: release.number,
      publishedAt: release.publishedAt,
      publishedBy: {
        id: release.publishedBy.id,
        name: release.publishedBy.name,
      },
    };
  }

  static list(releases: readonly ReleaseSummary[]): ReleaseListResponse {
    return {
      items: releases.map((release) => ReleasePresenter.summary(release)),
    };
  }

  static release(release: ReleaseView): ReleaseResponse {
    return {
      ...ReleasePresenter.summary(release),
      graph: GraphPresenter.graph(release.graph),
      settings: GraphPresenter.settings(release.settings),
    };
  }
}
