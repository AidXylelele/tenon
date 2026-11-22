import { StepName } from "../../../../src/interface-adapters/workflows/runners/step-name.js";

describe("the kind of a step, read from its journal name", () => {
  it.each([
    ["/do/0/fetch", "effect"],
    ["/fork/1/charge#2", "effect"],
    ["respond:/do/0/fetch", "respond"],
    ["child:/do/1/review", "child"],
    ["received#3", "received"],
    ["agenda#12", "agenda"],
    ["secrets", "secrets"],
    ["deliver", "deliver"],
  ])("%s_is_a_%s_step", (name, kind) => {
    const step = new StepName(name);

    expect(step.kind()).toBe(kind);
  });
});
