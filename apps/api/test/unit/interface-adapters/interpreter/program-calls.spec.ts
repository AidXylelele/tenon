import type { VersionProgram } from "../../../../src/application/automation/workflows/interfaces.js";
import type { WorkflowQueries } from "../../../../src/application/automation/workflows/queries.js";
import { ProtocolMapper } from "../../../../src/interface-adapters/interpreter/mappers/protocol.mapper.js";
import { ProgramCalls } from "../../../../src/interface-adapters/interpreter/program-calls.js";

const published: VersionProgram = {
  versionId: "version-1",
  digest: "digest-1",
  document: { do: [], note: undefined },
  imports: { library: "document: { dsl: 1.0.0 }" },
  secrets: ["crm"],
};

class StoredPrograms {
  readonly read: string[] = [];

  programById(versionId: string): Promise<VersionProgram | null> {
    this.read.push(versionId);
    const stored = versionId === published.versionId ? published : null;
    return Promise.resolve(stored);
  }
}

describe("the program calls the interpreter is handed", () => {
  const stored = new StoredPrograms();
  const calls = new ProgramCalls(
    stored as unknown as WorkflowQueries,
    new ProtocolMapper(),
  );

  beforeEach(() => {
    stored.read.length = 0;
  });

  it("a_call_reads_its_version_only_when_the_interpreter_asks_for_its_source", async () => {
    const call = calls.of("version-1", "fingerprint-1", null);
    const readBefore = stored.read.length;

    const source = await call.source();

    expect(readBefore).toBe(0);
    expect(stored.read).toEqual(["version-1"]);
    expect(source).toStrictEqual({
      document: { do: [] },
      imports: { library: "document: { dsl: 1.0.0 }" },
      secrets: ["crm"],
    });
  });

  it("a_call_for_a_version_that_is_gone_is_refused", async () => {
    const call = calls.of("version-2", null, null);

    const source = call.source();

    await expect(source).rejects.toThrow(TypeError);
  });
});
