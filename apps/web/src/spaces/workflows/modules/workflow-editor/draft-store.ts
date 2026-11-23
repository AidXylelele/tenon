import type { EditorView } from "@codemirror/view";
import { forgetHistory } from "@/libs/codemirror/base-setup";
import { takeOwnersText } from "@/libs/codemirror/owned-text";
import type {
  DraftRefusal,
  DraftRevision,
  DraftWrite,
} from "@/libs/data-access/types";
import type { JsonObject, JsonValue } from "@/libs/json/json";
import { reasonOf } from "@/libs/language-client/failures";
import {
  checkDraftAction,
  discardDraftAction,
  publishDraftAction,
  readDraftAction,
  saveDraftAction,
  testRunAction,
} from "./actions";
import type {
  Discarding,
  DraftState,
  Held,
  Publication,
  TestStart,
  WorkflowName,
} from "./interfaces";

type Conflict = Extract<DraftRefusal, { readonly kind: "conflict" }>;

const PAUSE_MS = 1500;
const RETRY_MS = 5000;
const SECOND_MS = 1000;
const TRANSIENT: ReadonlySet<number> = new Set([408, 429]);
const NO_LAYOUT: JsonObject = {};
const HELD: Held = { kind: "held" };
const DISCARDED: Discarding = { kind: "discarded" };

export class DraftStore {
  private etag: string | null;
  private base: string | null;
  private pending = false;
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private state: DraftState;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly workflow: WorkflowName,
    opened: DraftRevision | null,
    private readonly view: () => EditorView | null,
  ) {
    this.etag = opened?.etag ?? null;
    this.base = opened?.draft.source ?? null;
    const saved = opened === null ? null : DraftStore.savedOf(opened);
    this.state = {
      status: "clean",
      saved,
      failure: null,
      retrying: false,
      conflict: null,
    };
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly read = (): DraftState => this.state;

  changed(): void {
    this.pending = true;

    if (this.state.status === "clean") this.show({ status: "unsaved" });

    this.schedule(PAUSE_MS);
  }

  flush(): Promise<string | null> {
    this.stopTimer();
    return this.enqueue(null);
  }

  publish(): Promise<Publication> {
    return this.attempt((etag) => {
      const request = { ...this.workflow, etag };
      return publishDraftAction(request);
    });
  }

  test(input: JsonValue, key: string): Promise<TestStart> {
    return this.attempt((etag) => {
      const request = { ...this.workflow, etag, input, key };
      return testRunAction(request);
    });
  }

  async discard(published: string): Promise<Discarding> {
    this.stopTimer();
    this.pending = false;
    await this.queue.then(DraftStore.settled, DraftStore.settled);
    const etag = this.etag;

    if (etag === null) return this.forget(published);

    const request = { ...this.workflow, etag };
    const answer = await discardDraftAction(request);

    if (answer.kind === "refused") return answer;

    if (answer.kind === "discarded") return this.forget(published);

    await this.holdAgainst(answer.current);
    return HELD;
  }

  resolve(text: string): void {
    const open = this.state.conflict;
    const editor = this.view();

    if (open === null || editor === null) return;

    this.adopt(open.theirs);
    this.show({ conflict: null });
    DraftStore.replaceText(editor, text);
    void this.enqueue(null);
  }

  async recheck(): Promise<void> {
    const etag = this.etag;
    const quiet = this.state.status === "clean" && this.state.conflict === null;

    if (etag === null || !quiet) return;

    const answer = await checkDraftAction({ ...this.workflow, etag });

    if (answer.kind === "unchanged") return;

    if (answer.kind === "missing") {
      this.etag = null;
      return;
    }

    const editor = this.view();

    if (editor === null || this.text() !== this.base) {
      this.hold(answer.revision);
      return;
    }

    this.adopt(answer.revision);
    DraftStore.replaceText(editor, answer.revision.draft.source);
  }

  dispose(): void {
    this.stopTimer();
    this.closed = true;
    const unsaved = this.pending || this.state.status === "failed";

    if (unsaved && this.state.conflict === null) void this.enqueue(this.text());

    this.listeners.clear();
  }

  private async attempt<Answer extends { readonly kind: string }>(
    send: (etag: string) => Promise<Answer | Conflict>,
  ): Promise<Answer | Held> {
    const etag = await this.flush();

    if (etag === null) return HELD;

    const answer = await send(etag);

    if (!DraftStore.isConflict(answer)) return answer;

    await this.holdAgainst(answer.current);
    return HELD;
  }

  private schedule(delay: number): void {
    this.stopTimer();

    if (this.closed) return;

    this.timer = setTimeout(() => {
      void this.enqueue(null);
    }, delay);
  }

  private enqueue(captured: string | null): Promise<string | null> {
    const write = () => this.write(captured);
    const next = this.queue.then(write, write);
    this.queue = next;
    return next;
  }

  private async write(captured: string | null): Promise<string | null> {
    if (this.state.conflict !== null) return null;

    const text = captured ?? this.text();

    if (text === null) return null;

    if (this.etag !== null && text === this.base) {
      this.pending = false;
      this.show({ status: "clean", failure: null, retrying: false });
      return this.etag;
    }

    this.pending = false;
    this.show({ status: "saving" });

    try {
      const content = { source: text, layout: NO_LAYOUT };
      const request = { ...this.workflow, ...content, etag: this.etag };
      const answer = await saveDraftAction(request);
      return await this.settle(answer, text);
    } catch (reason) {
      this.fail(reasonOf(reason), RETRY_MS);
      return null;
    }
  }

  private async settle(
    answer: DraftWrite,
    text: string,
  ): Promise<string | null> {
    if (answer.kind === "saved") {
      this.adopt(answer.revision);
      const status = this.pending ? "unsaved" : "clean";
      this.show({ status, failure: null, retrying: false });
      return answer.revision.etag;
    }

    if (answer.kind === "refused") {
      const problem = answer.problem;
      const transient = problem.status >= 500 || TRANSIENT.has(problem.status);
      const asked = (problem.retryAfter ?? 0) * SECOND_MS;
      const delay = transient ? Math.max(RETRY_MS, asked) : null;
      this.fail(problem.detail, delay);
      return null;
    }

    const held = await this.holdAgainst(answer.current);

    if (held) return null;

    this.etag = null;
    return this.write(text);
  }

  private fail(failure: string, delay: number | null): void {
    const retrying = delay !== null;
    this.show({ status: "failed", failure, retrying });

    if (retrying) this.schedule(delay);
  }

  private async holdAgainst(current: DraftRevision | null): Promise<boolean> {
    const theirs = current ?? (await readDraftAction(this.workflow));

    if (theirs === null) return false;

    this.hold(theirs);
    return true;
  }

  private hold(theirs: DraftRevision): void {
    const conflict = { theirs, base: this.base };
    this.show({ status: "unsaved", conflict });
  }

  private forget(published: string): Discarding {
    this.etag = null;
    this.base = null;
    this.show({ status: "clean", saved: null, failure: null, retrying: false });
    const editor = this.view();

    if (editor !== null) DraftStore.replaceText(editor, published);

    return DISCARDED;
  }

  private adopt(revision: DraftRevision): void {
    this.etag = revision.etag;
    this.base = revision.draft.source;
    this.show({ saved: DraftStore.savedOf(revision) });
  }

  private show(change: Partial<DraftState>): void {
    this.state = { ...this.state, ...change };

    for (const listener of this.listeners) listener();
  }

  private text(): string | null {
    return this.view()?.state.doc.toString() ?? null;
  }

  private stopTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);

    this.timer = null;
  }

  private static settled(): void {
    return;
  }

  private static isConflict(answer: {
    readonly kind: string;
  }): answer is Conflict {
    return answer.kind === "conflict";
  }

  private static savedOf(revision: DraftRevision): DraftState["saved"] {
    return { by: revision.draft.savedBy, at: revision.draft.savedAt };
  }

  private static replaceText(editor: EditorView, text: string): void {
    takeOwnersText(editor, text);
    forgetHistory(editor);
  }
}
