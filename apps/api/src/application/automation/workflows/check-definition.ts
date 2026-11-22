import { Injectable } from "@nestjs/common";
import { Workflow } from "../../../domain/automation/workflows/workflow.js";
import { WorkflowSchedules } from "../schedules/ports.js";
import { SecretRepository } from "../secrets/ports.js";
import type { CheckDefinitionCommand, CheckResult } from "./interfaces.js";
import { DefinitionCompiler, WorkflowRepository } from "./ports.js";

@Injectable()
export class CheckDefinition {
  constructor(
    private readonly compiler: DefinitionCompiler,
    private readonly workflows: WorkflowRepository,
    private readonly secrets: SecretRepository,
    private readonly schedules: WorkflowSchedules,
  ) {}

  async execute(command: CheckDefinitionCommand): Promise<CheckResult> {
    const now = new Date();
    const owned = await this.secrets.findOwnedBy(command.publisherId);
    const compiled = await this.compiler.compile(command.document, owned);

    if (!compiled.ok) return compiled;

    const definition = compiled.value;
    const refusedSchedule = await this.schedules.check(definition);

    if (refusedSchedule !== null)
      return { ok: false, failure: [refusedSchedule] };

    const found = await this.workflows.findByName(definition.name);
    const workflow = found ?? Workflow.register(definition.name);
    const published = workflow.publish({
      definition,
      source: null,
      publisherId: command.publisherId,
      now,
    });

    if (!published.ok) return published;

    return { ok: true, value: undefined };
  }
}
