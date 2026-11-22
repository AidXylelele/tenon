import { diff } from "@codemirror/merge";
import { Transaction } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { forgetHistory } from "@/libs/codemirror/base-setup";
import type { DraftRevision, DraftWrite } from "@/libs/data-access/types";
import type { JsonObject } from "@/libs/json/json";
import { reasonOf } from "@/libs/language-client/failures";
import {
  checkDraftAction,
  publishDraftAction,
  readDraftAction,
  saveDraftAction,
} from "./actions";
import type { DraftState, Publication, WorkflowName } from "./interfaces";

const PAUSE_MS = 1500;
const RETRY_MS = 5000;
const SECOND_MS = 1000;
const TRANSIENT: ReadonlySet<number> = new Set([408, 429]);

export class DraftKeeper {
  private etag: string | null;
  private base: string | null;
  private layout: JsonObject;
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
    this.layout = opened?.draft.layout ?? {};
    const saved = opened === null ? null : DraftKeeper.savedOf(opened);
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

  async publish(): Promise<Publication> {
    const etag = await this.flush();

    if (etag === null) return { kind: "held" };

    const request = { ...this.workflow, etag };
    const answer = await publishDraftAction(request);

    if (answer.kind !== "conflict") return answer;

    await this.holdAgainst(answer.current);
    return { kind: "held" };
  }

  resolve(text: string): void {
    const open = this.state.conflict;
    const editor = this.view();

    if (open === null || editor === null) return;

    this.adopt(open.theirs);
    this.show({ conflict: null });
    DraftKeeper.replaceText(editor, text);
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
    DraftKeeper.replaceText(editor, answer.revision.draft.source);
  }

  dispose(): void {
    this.stopTimer();
    this.closed = true;
    const unsaved = this.pending || this.state.status === "failed";

    if (unsaved && this.state.conflict === null) void this.enqueue(this.text());

    this.listeners.clear();
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
      const content = { source: text, layout: this.layout };
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

  private adopt(revision: DraftRevision): void {
    this.etag = revision.etag;
    this.base = revision.draft.source;
    this.layout = revision.draft.layout;
    this.show({ saved: DraftKeeper.savedOf(revision) });
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

  private static savedOf(revision: DraftRevision): DraftState["saved"] {
    return { by: revision.draft.savedBy, at: revision.draft.savedAt };
  }

  private static replaceText(editor: EditorView, text: string): void {
    const current = editor.state.doc.toString();
    const changes = diff(current, text).map((change) => ({
      from: change.fromA,
      to: change.toA,
      insert: text.slice(change.fromB, change.toB),
    }));
    const annotations = [
      Transaction.addToHistory.of(false),
      Transaction.remote.of(true),
    ];
    editor.dispatch({ changes, annotations });
    forgetHistory(editor);
  }
}
