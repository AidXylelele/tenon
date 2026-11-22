import { LocksEvents } from "@nestjs/locks";
import { LockMetrics } from "../../../src/frameworks/opentelemetry/lock.metrics.js";
import { RecordedMetrics } from "../../support/recorded-metrics.js";

describe("the metrics of the locks", () => {
  let recorded: RecordedMetrics;

  beforeEach(() => {
    recorded = new RecordedMetrics();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("counts_each_lock_its_holder_lost_while_using_it", () => {
    const events = new LocksEvents();
    const lockMetrics = new LockMetrics(events);
    lockMetrics.onModuleInit();

    events.emit({
      type: "lock-lost",
      key: "receiver:0190a1b2",
      fencingToken: 4,
      detectedBy: "renewal",
    });
    events.emit({
      type: "leadership-acquired",
      key: "receiver:0190a1b2",
      fencingToken: 5,
    });
    lockMetrics.onApplicationShutdown();

    expect(recorded.pointsOf("tenon.lock.losses")).toEqual([
      { value: 1, attributes: undefined },
    ]);
  });

  it("counts_nothing_in_a_process_without_locks", () => {
    const lockMetrics = new LockMetrics();

    lockMetrics.onModuleInit();

    expect(recorded.pointsOf("tenon.lock.losses")).toEqual([]);
  });
});
