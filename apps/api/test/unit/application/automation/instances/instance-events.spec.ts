import { EventOrigin } from "../../../../../src/application/automation/events/enums.js";
import { InstanceEvents } from "../../../../../src/application/automation/instances/instance-events.js";
import { Phase } from "../../../../../src/domain/automation/instances/enums.js";
import type { LifecycleEvent } from "../../../../../src/domain/automation/instances/interfaces.js";
import { RunSecrets } from "../../../../../src/domain/automation/secrets/run-secrets.js";
import { aTurn } from "../../../../support/builders.js";
import {
  AppendingLifecycleEvents,
  RecordingAnnouncements,
  RecordingInstanceMessages,
  StoredWorkflowInstanceRepository,
  T0,
  anInstanceIn,
} from "../../../../support/fakes.js";

const STARTED: LifecycleEvent = {
  name: "workflow.started",
  types: ["io.serverlessworkflow.workflow.started.v1"],
  data: {},
  execution: null,
};

const COMPLETED: LifecycleEvent = {
  name: "task.completed",
  types: ["io.serverlessworkflow.task.completed.v1"],
  data: {},
  execution: "/do/0/fetch",
};

function setUp() {
  const instance = anInstanceIn(Phase.Pending);
  const turn = aTurn({ events: [STARTED, COMPLETED] });
  instance.begin(turn, RunSecrets.of([]), T0);
  const instances = new StoredWorkflowInstanceRepository(instance);
  const lifecycle = new AppendingLifecycleEvents();
  const announcements = new RecordingAnnouncements();
  const messages = new RecordingInstanceMessages(instances);
  const events = new InstanceEvents(lifecycle, announcements, messages);
  return { instance, lifecycle, announcements, messages, events };
}

describe("dispatching what an instance told", () => {
  it("announces_each_appended_lifecycle_event_as_lifecycle_and_sends_the_instances_messages", async () => {
    const fixture = setUp();

    await fixture.events.dispatch(fixture.instance);

    expect(fixture.announcements.announced).toEqual([
      { sequence: 1, origin: EventOrigin.Lifecycle },
      { sequence: 2, origin: EventOrigin.Lifecycle },
    ]);
    expect(fixture.messages.calls).toEqual([fixture.instance.id]);
  });

  it("appends_and_announces_a_lifecycle_event_once_across_dispatches", async () => {
    const fixture = setUp();

    await fixture.events.dispatch(fixture.instance);
    await fixture.events.dispatch(fixture.instance);

    expect(fixture.lifecycle.appended).toHaveLength(2);
    expect(fixture.announcements.announced).toHaveLength(2);
    expect(fixture.instance.lifecycle).toEqual([]);
  });
});
