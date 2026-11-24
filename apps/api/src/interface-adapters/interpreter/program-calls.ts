import { Injectable } from "@nestjs/common";
import { WorkflowQueries } from "../../application/automation/workflows/queries.js";
import type { ProgramCall, ProgramSource } from "./interfaces.js";
import { ProtocolMapper } from "./mappers/protocol.mapper.js";

@Injectable()
export class ProgramCalls {
  constructor(
    private readonly workflows: WorkflowQueries,
    private readonly protocol: ProtocolMapper,
  ) {}

  of(
    versionId: string,
    fingerprint: string | null,
    signal: AbortSignal | null,
  ): ProgramCall {
    const source = () => this.#sourceOf(versionId);
    return { versionId, fingerprint, source, signal };
  }

  async #sourceOf(versionId: string): Promise<ProgramSource> {
    const program = await this.workflows.programById(versionId);

    if (program === null)
      throw new TypeError(`The version ${versionId} is gone`);

    return this.protocol.toSource(program);
  }
}
