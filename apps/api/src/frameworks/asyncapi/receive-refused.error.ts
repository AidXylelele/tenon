export class ReceiveRefused extends Error {
  constructor(instanceId: string, execution: string) {
    super(`The instance ${instanceId} no longer receives on ${execution}`);
    this.name = new.target.name;
  }
}
