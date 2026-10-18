import type {
  ArtifactStore,
  RunQueries,
  StepOutputPage,
  StepOutputQuery,
} from '../interfaces.js';

export class ReadStepOutput {
  constructor(
    private readonly runs: RunQueries,
    private readonly artifacts: ArtifactStore,
  ) {}

  async execute(query: StepOutputQuery): Promise<StepOutputPage> {
    const run = await this.runs.get(query.runId);
    const step = run.steps.find(
      (candidate) => candidate.nodeId === query.nodeId,
    );
    const outputs = (step?.outputs ?? []).filter(
      (output) => output.port === query.port,
    );
    let total = 0;

    for (const output of outputs) {
      total += output.items;
    }

    const items = await this.artifacts.read(outputs, query.offset, query.limit);
    return { items, total, offset: query.offset };
  }
}
