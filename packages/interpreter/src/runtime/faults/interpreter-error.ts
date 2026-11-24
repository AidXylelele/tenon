export class InterpreterError extends Error {
  static {
    Object.defineProperty(this.prototype, "name", {
      value: "InterpreterError",
      writable: true,
      configurable: true,
    });
  }
}
