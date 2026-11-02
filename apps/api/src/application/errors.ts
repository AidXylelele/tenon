export class WorkDeferredError extends Error {
  constructor() {
    super('The work found no free capacity and is deferred');
  }
}
