import type { WorkflowContext } from '@nestjs/workflows';
import {
  type TransactionalAdapter,
  TransactionHost,
} from '@nestjs-cls/transactional';
import type { NodeOutcome } from '../../../src/application/interfaces.js';
import type { BeginRun } from '../../../src/application/use-cases/begin-run.js';
import type { ExecuteNode } from '../../../src/application/use-cases/execute-node.js';
import type { FinishRun } from '../../../src/application/use-cases/finish-run.js';
import type { ReachNode } from '../../../src/application/use-cases/reach-node.js';
import type { RecordNode } from '../../../src/application/use-cases/record-node.js';
import type { TerminateRun } from '../../../src/application/use-cases/terminate-run.js';
import { Arrival } from '../../../src/domain/enums.js';
import { RunConflictError } from '../../../src/domain/errors.js';
import { RunWorkflow } from '../../../src/interface-adapters/workflows/run.workflow.js';

const outcome: NodeOutcome = { outputs: [], failure: null, fields: [] };

type FakeAdapter = TransactionalAdapter<null, object | null, object>;

const host = new TransactionHost<FakeAdapter>({
  connectionName: undefined,
  enableTransactionProxy: false,
  defaultTxOptions: {},
  extraProviderTokens: [],
  getFallbackInstance: () => null,
  wrapWithTransaction: (_options, work, setTx) => {
    setTx({});
    return work();
  },
});

const engine = () => {
  const names: string[] = [];
  const ctx = {
    step: async (
      name: string,
      work: (step: { attempt: number }) => unknown,
    ) => {
      names.push(name);
      return work({ attempt: 1 });
    },
  } as unknown as WorkflowContext;
  return { ctx, names };
};

const seen = {
  executed: 0,
  recorded: 0,
  transactional: [] as string[],
  outside: [] as string[],
};

const note = (name: string) => {
  const active = host.isTransactionActive();

  if (active) {
    seen.transactional.push(name);
  } else {
    seen.outside.push(name);
  }
};

const workflow = (conflicts: number) => {
  seen.executed = 0;
  seen.recorded = 0;
  seen.transactional = [];
  seen.outside = [];
  let remaining = conflicts;
  return new RunWorkflow(
    {
      execute: () => {
        note('begin');
        return Promise.resolve(['a']);
      },
    } as unknown as BeginRun,
    {
      execute: () => {
        note('reach');
        return Promise.resolve(Arrival.Execute);
      },
    } as unknown as ReachNode,
    {
      execute: () => {
        note('execute');
        seen.executed += 1;
        return Promise.resolve({ outcome, retryInMs: null });
      },
    } as unknown as ExecuteNode,
    {
      execute: () => {
        note('record');
        seen.recorded += 1;

        if (remaining > 0) {
          remaining -= 1;
          return Promise.reject(new RunConflictError());
        }

        return Promise.resolve();
      },
    } as unknown as RecordNode,
    {
      execute: () => {
        note('finish');
        return Promise.resolve();
      },
    } as unknown as FinishRun,
    { execute: () => Promise.resolve() } as unknown as TerminateRun,
  );
};

describe('RunWorkflow', () => {
  it('a_node_is_executed_and_recorded_in_one_engine_step', async () => {
    const { ctx, names } = engine();
    await workflow(0).run(ctx, { runId: 'r', workflowId: 'w' });
    expect(names).toEqual(['begin', 'reach:a', 'execute:a', 'finish']);
    expect(seen.executed).toBe(1);
    expect(seen.recorded).toBe(1);
  });

  it('every_write_runs_in_a_transaction_and_the_node_runs_outside_one', async () => {
    const { ctx } = engine();
    await workflow(0).run(ctx, { runId: 'r', workflowId: 'w' });
    expect(seen.transactional).toEqual(['begin', 'reach', 'record', 'finish']);
    expect(seen.outside).toEqual(['execute']);
  });

  it('a_version_conflict_while_recording_records_again_without_executing_again', async () => {
    const { ctx } = engine();
    await workflow(2).run(ctx, { runId: 'r', workflowId: 'w' });
    expect(seen.executed).toBe(1);
    expect(seen.recorded).toBe(3);
  });
});
