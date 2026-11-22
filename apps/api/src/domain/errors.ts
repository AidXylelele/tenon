export class StaleWriteError extends Error {
  constructor() {
    super("The resource was changed meanwhile; read it again and retry");
    this.name = "StaleWriteError";
  }
}

export class PermanentFault extends Error {}
