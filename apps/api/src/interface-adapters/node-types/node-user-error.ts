export class NodeUserError extends Error {
  readonly parameter: string | null;
  readonly item: number | null;

  constructor(
    message: string,
    parameter: string | null = null,
    item: number | null = null,
  ) {
    super(message);
    this.name = 'NodeUserError';
    this.parameter = parameter;
    this.item = item;
  }
}
