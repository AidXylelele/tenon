export class NodeLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NodeLimitError';
  }
}
