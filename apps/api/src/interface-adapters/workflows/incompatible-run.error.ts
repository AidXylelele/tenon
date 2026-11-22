import { PermanentFault } from "../../domain/errors.js";

export class IncompatibleRun extends PermanentFault {
  constructor() {
    super("This build of the interpreter does not rebuild the run's program");
    this.name = new.target.name;
  }
}
