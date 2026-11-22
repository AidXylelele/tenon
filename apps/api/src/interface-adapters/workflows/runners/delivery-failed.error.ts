export class DeliveryFailed extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = new.target.name;
  }
}
