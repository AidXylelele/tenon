import request from 'supertest';
import { Role } from '../../../src/domain/identity/enums.js';
import { authHeaders, createUser, signIn } from '../../support/auth-helpers.js';
import { aDocument } from '../../support/builders.js';
import type { TestApp } from '../../support/create-test-app.js';
import {
  aWaitingDocument,
  createRunApp,
  drain,
  engineRunCount,
  eventually,
  instanceOf,
  namesOf,
  progressRowCount,
  publish,
  relay,
  type RunApp,
  resetRuns,
  start,
  statusesOf,
  tasksOf,
} from '../../support/run-helpers.js';

const PROBLEM = 'application/problem+json';
const UNKNOWN = '00000000-0000-4000-8000-000000000000';

describe('suspending, resuming, cancelling, restarting and deleting instances over HTTP', () => {
  let run: RunApp;
  let t: TestApp;
  let editor: Record<string, string>;
  let other: Record<string, string>;
  let viewer: Record<string, string>;
  let otherId: string;

  beforeAll(async () => {
    run = await createRunApp();
    t = run.t;
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await resetRuns(t);
    await createUser(t, { email: 'editor@example.com', role: Role.Editor });
    const second = await createUser(t, {
      email: 'other@example.com',
      role: Role.Editor,
    });
    otherId = second.id;
    await createUser(t, { email: 'viewer@example.com', role: Role.Viewer });
    editor = authHeaders(await signIn(t.server, 'editor@example.com'));
    other = authHeaders(await signIn(t.server, 'other@example.com'));
    viewer = authHeaders(await signIn(t.server, 'viewer@example.com'));
  });

  const control = (id: string, action: string, as = editor) =>
    request(t.server).post(`/api/v1/instances/${id}/${action}`).set(as);

  async function waitingInstance(): Promise<string> {
    await publish(t, editor, aWaitingDocument({ name: 'waiter' }));
    const started = await start(
      t,
      editor,
      { input: { lead: 'ada' } },
      'sales/waiter',
    );
    await drain(t);
    return started.id;
  }

  async function completedInstance(): Promise<string> {
    await publish(t, editor, aDocument());
    const started = await start(t, editor, { input: { lead: 'ada' } });
    await drain(t);
    return started.id;
  }

  // An instance whose first task is an outbound call answered after 400 ms.
  async function slowCallInstance(): Promise<string> {
    run.agent
      .get('https://crm.example.com')
      .intercept({ path: '/leads/1', method: 'GET' })
      .reply(
        200,
        { id: 1, name: 'Ada' },
        {
          headers: { 'content-type': 'application/json' },
        },
      )
      .delay(400);
    const document = aDocument({ name: 'caller' }, [
      {
        fetch: {
          call: 'http',
          with: { method: 'get', endpoint: 'https://crm.example.com/leads/1' },
        },
      },
      { after: { set: { done: true } } },
    ]);
    await publish(t, editor, document);
    const started = await start(t, editor, { input: {} }, 'sales/caller');
    return started.id;
  }

  async function callInFlight(id: string): Promise<void> {
    await eventually(async () => {
      const tasks = await tasksOf(t, viewer, id);
      return tasks.some((task) => task.status === 'running');
    });
  }

  describe('waiting', () => {
    it('a_wait_leaves_the_instance_waiting_until_the_clock_passes_its_duration', async () => {
      const id = await waitingInstance();

      const waiting = await instanceOf(t, viewer, id);
      const during = await tasksOf(t, viewer, id);
      run.clock.advance('59m');
      await drain(t);
      const early = await instanceOf(t, viewer, id);
      run.clock.advance('1m');
      await drain(t);
      const done = await instanceOf(t, viewer, id);
      const after = await tasksOf(t, viewer, id);

      expect(waiting.phase).toBe('waiting');
      expect(waiting.startedAt).not.toBeNull();
      expect(waiting.endedAt).toBeNull();
      expect(statusesOf(during)).toEqual(['before:completed', 'pause:running']);
      expect(during[1]?.endedAt).toBeNull();
      expect(early.phase).toBe('waiting');
      expect(done.phase).toBe('completed');
      expect(done.output).toEqual({ step: 'after', done: true });
      expect(statusesOf(after)).toEqual([
        'before:completed',
        'pause:completed',
        'after:completed',
      ]);
    });

    it('waiting_instances_are_listed_by_their_phase', async () => {
      const id = await waitingInstance();

      const listed = await request(t.server)
        .get('/api/v1/instances?phase=waiting')
        .set(viewer)
        .expect(200);

      const items = listed.body.items as { id: string }[];

      expect(items.map((item) => item.id)).toEqual([id]);
    });
  });

  describe('suspend and resume', () => {
    it('a_suspended_waiting_instance_starts_no_task_until_resumed_and_then_completes', async () => {
      const id = await waitingInstance();

      await control(id, 'suspend').expect(204);
      const suspended = await instanceOf(t, viewer, id);
      run.clock.advance('2h');
      await drain(t);
      const held = await instanceOf(t, viewer, id);
      const heldTasks = await tasksOf(t, viewer, id);
      await control(id, 'resume').expect(204);
      await relay(t);
      await drain(t);
      const resumed = await instanceOf(t, viewer, id);
      const tasks = await tasksOf(t, viewer, id);

      expect(suspended.phase).toBe('suspended');
      expect(held.phase).toBe('suspended');
      expect(namesOf(heldTasks)).toEqual(['before', 'pause']);
      expect(heldTasks[1]?.status).toBe('completed');
      expect(resumed.phase).toBe('completed');
      expect(resumed.output).toEqual({ step: 'after', done: true });
      expect(statusesOf(tasks)).toEqual([
        'before:completed',
        'pause:completed',
        'after:completed',
      ]);
    });

    it('a_held_run_stays_held_across_its_recheck_interval', async () => {
      const id = await waitingInstance();
      await control(id, 'suspend').expect(204);
      run.clock.advance('1h');
      await drain(t);

      for (let minute = 0; minute < 5; minute += 1) {
        run.clock.advance('61s');
        await drain(t);
      }

      const held = await instanceOf(t, viewer, id);
      const tasks = await tasksOf(t, viewer, id);

      expect(held.phase).toBe('suspended');
      expect(namesOf(tasks)).toEqual(['before', 'pause']);
    });

    // The standard's `waiting`: an instance whose wait has not elapsed is still waiting after a resume.
    it('a_resume_before_the_wait_elapses_returns_the_instance_to_waiting_and_it_completes_on_time', async () => {
      const id = await waitingInstance();
      await control(id, 'suspend').expect(204);

      await control(id, 'resume').expect(204);
      await relay(t);
      await drain(t);
      const resumed = await instanceOf(t, viewer, id);
      run.clock.advance('1h');
      await drain(t);
      const done = await instanceOf(t, viewer, id);

      expect(resumed.phase).toBe('waiting');
      expect(done.phase).toBe('completed');
    });

    it('a_suspend_during_an_outbound_call_lets_the_call_finish_and_starts_no_next_task', async () => {
      const id = await slowCallInstance();

      const draining = drain(t);
      await callInFlight(id);
      const running = await instanceOf(t, viewer, id);
      await control(id, 'suspend').expect(204);
      await draining;
      const held = await instanceOf(t, viewer, id);
      const heldTasks = await tasksOf(t, viewer, id);
      await control(id, 'resume').expect(204);
      await relay(t);
      await drain(t);
      const done = await instanceOf(t, viewer, id);

      expect(running.phase).toBe('running');
      expect(held.phase).toBe('suspended');
      expect(statusesOf(heldTasks)).toEqual(['fetch:completed']);
      expect(heldTasks[0]?.output).toEqual({ id: 1, name: 'Ada' });
      expect(done.phase).toBe('completed');
      expect(done.output).toEqual({ done: true });
    });

    it('suspend_is_refused_for_a_pending_suspended_or_ended_instance', async () => {
      const suspended = await waitingInstance();
      await control(suspended, 'suspend').expect(204);
      const ended = await completedInstance();
      const pending = await start(t, editor);

      const twice = await control(suspended, 'suspend').expect(409);
      const finished = await control(ended, 'suspend').expect(409);
      const early = await control(pending.id, 'suspend').expect(409);

      expect(twice.headers['content-type']).toContain(PROBLEM);
      expect(twice.body).toMatchObject({
        type: 'urn:problem:instance.not-running',
        status: 409,
      });
      expect(finished.body.type).toBe('urn:problem:instance.not-running');
      expect(early.body.type).toBe('urn:problem:instance.not-running');
    });

    it('resume_is_refused_unless_the_instance_is_suspended', async () => {
      const waiting = await waitingInstance();
      const ended = await completedInstance();

      const notSuspended = await control(waiting, 'resume').expect(409);
      const finished = await control(ended, 'resume').expect(409);
      const instance = await instanceOf(t, viewer, waiting);

      expect(notSuspended.headers['content-type']).toContain(PROBLEM);
      expect(notSuspended.body).toMatchObject({
        type: 'urn:problem:instance.not-suspended',
        status: 409,
      });
      expect(finished.body.type).toBe('urn:problem:instance.not-suspended');
      expect(instance.phase).toBe('waiting');
    });
  });

  describe('cancel', () => {
    it('a_cancel_during_a_wait_ends_the_instance_cancelled_and_no_later_task_runs', async () => {
      const id = await waitingInstance();

      await control(id, 'cancel').expect(204);
      const cancelled = await instanceOf(t, viewer, id);
      await relay(t);
      run.clock.advance('2h');
      await drain(t);
      const later = await instanceOf(t, viewer, id);
      const tasks = await tasksOf(t, viewer, id);

      expect(cancelled.phase).toBe('cancelled');
      expect(cancelled.endedAt).not.toBeNull();
      expect(cancelled.output).toBeNull();
      expect(later).toEqual(cancelled);
      expect(namesOf(tasks)).toEqual(['before', 'pause']);
    });

    // FR-015: a terminal instance shows no task still in progress.
    it('no_task_of_a_cancelled_instance_is_left_running', async () => {
      const id = await waitingInstance();

      await control(id, 'cancel').expect(204);
      await relay(t);
      run.clock.advance('2h');
      await drain(t);
      const tasks = await tasksOf(t, viewer, id);

      expect(tasks.filter((task) => task.status === 'running')).toEqual([]);
    });

    it('a_cancel_during_an_outbound_call_ends_the_instance_cancelled_and_starts_no_next_task', async () => {
      const id = await slowCallInstance();

      const draining = drain(t);
      await callInFlight(id);
      await control(id, 'cancel').expect(204);
      await relay(t);
      await draining;
      await drain(t);
      const instance = await instanceOf(t, viewer, id);
      const tasks = await tasksOf(t, viewer, id);

      expect(instance.phase).toBe('cancelled');
      expect(instance.output).toBeNull();
      expect(namesOf(tasks)).toEqual(['fetch']);
    });

    it('a_cancel_of_a_pending_instance_runs_none_of_its_tasks', async () => {
      await publish(t, editor, aDocument());
      const started = await start(t, editor);

      await control(started.id, 'cancel').expect(204);
      await relay(t);
      await drain(t);
      const instance = await instanceOf(t, viewer, started.id);
      const tasks = await tasksOf(t, viewer, started.id);

      expect(instance.phase).toBe('cancelled');
      expect(instance.output).toBeNull();
      expect(tasks).toEqual([]);
    });

    it('a_cancel_of_a_suspended_instance_ends_it_and_a_resume_is_then_refused', async () => {
      const id = await waitingInstance();
      await control(id, 'suspend').expect(204);

      await control(id, 'cancel').expect(204);
      await relay(t);
      const refused = await control(id, 'resume').expect(409);
      run.clock.advance('2h');
      await drain(t);
      const instance = await instanceOf(t, viewer, id);
      const tasks = await tasksOf(t, viewer, id);

      expect(refused.body.type).toBe('urn:problem:instance.not-suspended');
      expect(instance.phase).toBe('cancelled');
      expect(namesOf(tasks)).toEqual(['before', 'pause']);
    });

    it('every_control_request_on_an_ended_instance_is_refused_and_changes_nothing', async () => {
      const id = await completedInstance();
      const before = await instanceOf(t, viewer, id);

      const cancel = await control(id, 'cancel').expect(409);
      await control(id, 'suspend').expect(409);
      await control(id, 'resume').expect(409);
      const after = await instanceOf(t, viewer, id);

      expect(cancel.headers['content-type']).toContain(PROBLEM);
      expect(cancel.body).toMatchObject({
        type: 'urn:problem:instance.ended',
        status: 409,
      });
      expect(after).toEqual(before);
    });

    it('a_second_cancel_is_refused', async () => {
      const id = await waitingInstance();
      await control(id, 'cancel').expect(204);

      const again = await control(id, 'cancel').expect(409);

      expect(again.body.type).toBe('urn:problem:instance.ended');
    });

    it('control_requests_on_an_unknown_instance_are_not_found', async () => {
      for (const action of ['cancel', 'suspend', 'resume', 'restart']) {
        const missing = await control(UNKNOWN, action).expect(404);
        expect(missing.headers['content-type']).toContain(PROBLEM);
        expect(missing.body).toMatchObject({
          type: 'urn:problem:instance.not-found',
          status: 404,
        });
      }

      const deleted = await request(t.server)
        .delete(`/api/v1/instances/${UNKNOWN}`)
        .set(editor)
        .expect(404);
      await control('not-a-uuid', 'cancel').expect(400);

      expect(deleted.body.type).toBe('urn:problem:instance.not-found');
    });
  });

  describe('restart', () => {
    it('a_restart_of_an_ended_instance_starts_a_new_one_with_the_same_input_version_and_its_origin', async () => {
      const id = await completedInstance();
      await publish(t, editor, aDocument({ version: '2.0.0' }));
      const previous = await instanceOf(t, viewer, id);

      const restarted = await control(id, 'restart', other).expect(201);
      const newId = String(restarted.body.id);
      const fresh = await instanceOf(t, viewer, newId);
      await drain(t);
      const done = await instanceOf(t, viewer, newId);
      const unchanged = await instanceOf(t, viewer, id);

      expect(newId).not.toBe(id);
      expect(restarted.body).toMatchObject({
        namespace: 'sales',
        name: 'route-lead',
        version: '1.0.0',
        phase: 'pending',
        trigger: 'restart',
      });
      expect(fresh).toMatchObject({
        input: { lead: 'ada' },
        originId: id,
        starterId: otherId,
        output: null,
      });
      expect(done.phase).toBe('completed');
      expect(done.output).toEqual(previous.output);
      expect(unchanged).toEqual(previous);
    });

    it('faulted_and_cancelled_instances_restart_too', async () => {
      await publish(
        t,
        editor,
        aDocument({ name: 'failing' }, [
          {
            fail: {
              raise: {
                error: { type: 'https://example.com/errors/x', status: 500 },
              },
            },
          },
        ]),
      );
      const faulted = await start(t, editor, { input: {} }, 'sales/failing');
      await drain(t);
      const waiting = await waitingInstance();
      await control(waiting, 'cancel').expect(204);
      await relay(t);

      const fromFaulted = await control(faulted.id, 'restart').expect(201);
      const fromCancelled = await control(waiting, 'restart').expect(201);

      expect(fromFaulted.body.trigger).toBe('restart');
      expect(fromCancelled.body.trigger).toBe('restart');
    });

    it('a_restart_of_an_instance_that_has_not_ended_is_refused', async () => {
      const waiting = await waitingInstance();
      await publish(t, editor, aDocument({ version: '1.0.1' }));
      const pending = await start(t, editor);

      const refused = await control(waiting, 'restart').expect(409);
      await control(pending.id, 'restart').expect(409);
      await control(waiting, 'suspend').expect(204);
      await control(waiting, 'restart').expect(409);
      const listed = await request(t.server)
        .get('/api/v1/instances')
        .set(viewer)
        .expect(200);

      expect(refused.headers['content-type']).toContain(PROBLEM);
      expect(refused.body).toMatchObject({
        type: 'urn:problem:instance.not-ended',
        status: 409,
      });
      expect(listed.body.items).toHaveLength(2);
    });

    it('a_restart_in_an_archived_workflow_is_refused', async () => {
      const id = await completedInstance();
      await request(t.server)
        .post('/api/v1/workflows/sales/route-lead/archive')
        .set(editor)
        .expect(204);

      const refused = await control(id, 'restart').expect(409);

      expect(refused.body.type).toBe('urn:problem:workflow.archived');
    });
  });

  describe('delete', () => {
    it('a_delete_of_an_ended_instance_removes_it_its_tasks_and_its_run', async () => {
      const id = await completedInstance();
      const kept = await completedInstance();

      await request(t.server)
        .delete(`/api/v1/instances/${id}`)
        .set(editor)
        .expect(204);
      await relay(t);
      const listed = await request(t.server)
        .get('/api/v1/instances')
        .set(viewer)
        .expect(200);

      await request(t.server)
        .get(`/api/v1/instances/${id}`)
        .set(viewer)
        .expect(404);
      await request(t.server)
        .get(`/api/v1/instances/${id}/tasks`)
        .set(viewer)
        .expect(404);
      await request(t.server)
        .delete(`/api/v1/instances/${id}`)
        .set(editor)
        .expect(404);
      await control(id, 'restart').expect(404);
      expect(await progressRowCount(t, id)).toBe(0);
      expect(await engineRunCount(t, id)).toBe(0);
      const items = listed.body.items as { id: string }[];
      expect(items.map((item) => item.id)).toEqual([kept]);
      expect(await progressRowCount(t, kept)).toBe(1);
    });

    it('a_delete_of_a_pending_waiting_or_suspended_instance_is_refused', async () => {
      const waiting = await waitingInstance();
      await publish(t, editor, aDocument({ version: '1.0.1' }));
      const pending = await start(t, editor);

      const refused = await request(t.server)
        .delete(`/api/v1/instances/${waiting}`)
        .set(editor)
        .expect(409);
      await request(t.server)
        .delete(`/api/v1/instances/${pending.id}`)
        .set(editor)
        .expect(409);
      await control(waiting, 'suspend').expect(204);
      await request(t.server)
        .delete(`/api/v1/instances/${waiting}`)
        .set(editor)
        .expect(409);
      const instance = await instanceOf(t, viewer, waiting);

      expect(refused.headers['content-type']).toContain(PROBLEM);
      expect(refused.body).toMatchObject({
        type: 'urn:problem:instance.not-ended',
        status: 409,
      });
      expect(instance.phase).toBe('suspended');
    });

    it('a_cancelled_instance_is_deleted_and_its_sleeping_run_never_wakes', async () => {
      const id = await waitingInstance();
      await control(id, 'cancel').expect(204);

      await request(t.server)
        .delete(`/api/v1/instances/${id}`)
        .set(editor)
        .expect(204);
      await relay(t);
      run.clock.advance('2h');
      await drain(t);

      expect(await engineRunCount(t, id)).toBe(0);
      expect(await progressRowCount(t, id)).toBe(0);
    });
  });
});
