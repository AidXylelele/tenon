export class RecordingResizeObserver {
  static readonly callbacks: (() => void)[] = [];

  constructor(callback: () => void) {
    RecordingResizeObserver.callbacks.push(callback);
  }

  observe(): void {
    return undefined;
  }

  disconnect(): void {
    return undefined;
  }
}
