import type { TextDocument } from "vscode-languageserver-textdocument";

export class DiagnosticsSchedule {
  readonly #publish: (document: TextDocument) => void;
  readonly #pause: number;
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(publish: (document: TextDocument) => void, pause: number) {
    this.#publish = publish;
    this.#pause = pause;
  }

  changed(document: TextDocument): void {
    const uri = document.uri;
    this.closed(uri);

    const timer = setTimeout(() => {
      this.#timers.delete(uri);
      this.#publish(document);
    }, this.#pause);
    this.#timers.set(uri, timer);
  }

  closed(uri: string): void {
    const timer = this.#timers.get(uri);

    clearTimeout(timer);
    this.#timers.delete(uri);
  }
}
