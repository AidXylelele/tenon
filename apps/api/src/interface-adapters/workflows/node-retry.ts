export class NodeRetry extends Error {
  constructor(readonly waitMs: number) {
    super(`The node is tried again in ${waitMs} ms`);
    this.name = 'NodeRetry';
  }
}
