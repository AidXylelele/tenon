import { randomUUID } from 'node:crypto';
import { Injectable, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import {
  ManualWorkflowClock,
  Workflow,
  WORKFLOWS_MODULE_OPTIONS,
  WorkflowClient,
  type WorkflowContext,
  type WorkflowRunner,
  WorkflowSignal,
  WorkflowWorker,
} from '@nestjs/workflows';
import { sql } from 'drizzle-orm';
import { ConfigModule } from '../../../src/frameworks/di/config.module.js';
import { DatabaseModule } from '../../../src/frameworks/di/database.module.js';
import { EngineModule } from '../../../src/frameworks/di/engine.module.js';
import { Database } from '../../../src/interface-adapters/interfaces.js';

const wake = new WorkflowSignal<{ by: string }>('wake');

@Injectable()
class Gate {
  calls = 0;
  #open: () => void = () => undefined;
  #opened = new Promise<void>((resolve) => {
    this.#open = resolve;
  });

  pass(): Promise<string> {
    this.calls += 1;
    return this.#opened.then(() => 'passed');
  }

  open(): void {
    this.#open();
  }
}

interface ProbeInput {
  readonly key: string;
}

@Workflow('probe-round')
class RoundProbe implements WorkflowRunner<ProbeInput, string> {
  constructor(private readonly gate: Gate) {}

  async run(ctx: WorkflowContext, input: ProbeInput): Promise<string> {
    await ctx.step('advance-1', () => this.gate.pass());
    const woken = await ctx.waitForSignal('park-1', wake, {
      key: input.key,
      timeout: '1h',
    });

    if (woken === null) return 'timed-out';

    return `woken by ${woken.by}`;
  }
}

interface Node {
  readonly app: INestApplication;
  readonly client: WorkflowClient;
  readonly worker: WorkflowWorker;
  readonly transactions: TransactionHost<
    TransactionalAdapterDrizzleOrm<Database>
  >;
}

async function bootNode(clock: ManualWorkflowClock, gate: Gate): Promise<Node> {
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule, DatabaseModule, EngineModule],
    providers: [RoundProbe, Gate],
  })
    .overrideProvider(WORKFLOWS_MODULE_OPTIONS)
    .useValue({
      clock,
      worker: { enabled: false, leaseDuration: '3s', shutdownTimeout: 50 },
    })
    .overrideProvider(Gate)
    .useValue(gate)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return {
    app,
    client: app.get(WorkflowClient),
    worker: app.get(WorkflowWorker),
    transactions: app.get(TransactionHost),
  };
}

describe('engine module', () => {
  let clock: ManualWorkflowClock;
  let gate: Gate;
  let node: Node;

  beforeEach(async () => {
    clock = new ManualWorkflowClock();
    gate = new Gate();
    node = await bootNode(clock, gate);
    await node.app
      .get(Database)
      .execute(
        sql`truncate table nest_workflows.instances, nest_workflows.journal, nest_workflows.waits, nest_workflows.signals cascade`,
      );
  });

  afterEach(async () => {
    gate.open();
    await node.app.close();
  });

  it('a_start_in_a_rolled_back_transaction_leaves_no_instance', async () => {
    const id = randomUUID();
    const rolledBack = node.transactions.withTransaction(async () => {
      await node.client.start(
        RoundProbe,
        { key: id },
        { id, transaction: node.transactions.tx },
      );
      throw new Error('the surrounding change failed');
    });

    await expect(rolledBack).rejects.toThrow('the surrounding change failed');
    expect(await node.client.getStatus(id)).toBeNull();
  });

  it('a_start_and_a_signal_in_committed_transactions_run_the_instance_without_waiting', async () => {
    const id = randomUUID();
    await node.transactions.withTransaction(() =>
      node.client.start(
        RoundProbe,
        { key: id },
        { id, transaction: node.transactions.tx },
      ),
    );
    await node.transactions.withTransaction(() =>
      node.client.signal(
        wake,
        { by: 'a committed change' },
        { key: id, transaction: node.transactions.tx },
      ),
    );
    gate.open();
    await node.worker.drain();

    const instance = await node.client.getStatus(id);
    expect(instance?.status).toBe('completed');
    expect(instance?.output).toBe('woken by a committed change');
  });

  it('a_signal_sent_while_the_round_runs_is_taken_by_the_park_that_follows', async () => {
    const id = randomUUID();
    await node.client.start(RoundProbe, { key: id }, { id });
    const draining = node.worker.drain();
    await vi.waitFor(() => {
      expect(gate.calls).toBe(1);
    });
    await node.client.signal(wake, { by: 'an event' }, { key: id });
    gate.open();
    await draining;

    const instance = await node.client.getStatus(id);
    expect(instance?.status).toBe('completed');
    expect(instance?.output).toBe('woken by an event');
  });

  it('a_long_step_keeps_its_lease_so_another_worker_does_not_run_it_again', async () => {
    const id = randomUUID();
    const other = await bootNode(clock, gate);
    await node.client.start(RoundProbe, { key: id }, { id });
    const draining = node.worker.drain();
    await vi.waitFor(() => {
      expect(gate.calls).toBe(1);
    });
    const claimed = await node.client.getStatus(id);
    const firstLeaseUntil = claimed?.leaseUntil ?? 0;

    clock.advance('2s');
    await vi.waitFor(
      async () => {
        const renewed = await node.client.getStatus(id);
        expect(renewed?.leaseUntil ?? 0).toBeGreaterThan(firstLeaseUntil);
      },
      { timeout: 5_000 },
    );
    clock.advance('2s');
    const takenOver = await other.worker.drain();
    gate.open();
    await draining;
    await other.app.close();

    expect(takenOver).toBe(0);
    expect(gate.calls).toBe(1);
  });
});
