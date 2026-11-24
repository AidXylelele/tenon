import type { LSPClient } from "@codemirror/lsp-client";
import {
  type DataAtParams,
  type DataAtResult,
  type DocumentParams,
  type DocumentResult,
  type EditAction,
  type EditParams,
  type EditResult,
  methods,
  type RangesOfParams,
  type RangesOfResult,
  type ReadConditionParams,
  type ReadConditionResult,
  type ReadTemplateParams,
  type ReadTemplateResult,
  type StepFormParams,
  type StepFormResult,
  type StructureParams,
  type StructureResult,
  type WorkflowFormParams,
  type WorkflowFormResult,
} from "language-server/protocol";
import type { VersionedTextDocumentIdentifier } from "vscode-languageserver-protocol";
import type { JsonValue } from "@/libs/json/json";

export class WorkflowSession {
  constructor(
    private readonly client: LSPClient,
    readonly uri: string,
  ) {}

  async structure(): Promise<StructureResult> {
    const textDocument = this.synced();
    return await this.client.request<StructureParams, StructureResult>(
      methods.structure,
      { textDocument },
    );
  }

  async stepForm(step: string): Promise<StepFormResult> {
    const textDocument = this.synced();
    return await this.client.request<StepFormParams, StepFormResult>(
      methods.stepForm,
      { textDocument, step },
    );
  }

  async workflowForm(): Promise<WorkflowFormResult> {
    const textDocument = this.synced();
    return await this.client.request<WorkflowFormParams, WorkflowFormResult>(
      methods.workflowForm,
      { textDocument },
    );
  }

  async edit(action: EditAction): Promise<EditResult> {
    const textDocument = this.synced();
    return await this.client.request<EditParams, EditResult>(methods.edit, {
      textDocument,
      action,
    });
  }

  async document(): Promise<DocumentResult> {
    const textDocument = this.synced();
    return await this.client.request<DocumentParams, DocumentResult>(
      methods.document,
      { textDocument },
    );
  }

  async rangesOf(pointers: readonly string[]): Promise<RangesOfResult> {
    const textDocument = this.synced();
    return await this.client.request<RangesOfParams, RangesOfResult>(
      methods.rangesOf,
      { textDocument, pointers },
    );
  }

  async dataAt(
    step: string,
    field: string,
    samples: Readonly<Record<string, JsonValue>>,
    typed: string,
  ): Promise<DataAtResult> {
    const textDocument = this.synced();
    return await this.client.request<DataAtParams, DataAtResult>(
      methods.dataAt,
      { textDocument, step, field, samples, typed },
    );
  }

  async readTemplate(pointer: string): Promise<ReadTemplateResult> {
    const textDocument = this.synced();
    return await this.client.request<ReadTemplateParams, ReadTemplateResult>(
      methods.readTemplate,
      { textDocument, pointer },
    );
  }

  async readCondition(text: string): Promise<ReadConditionResult> {
    return await this.client.request<ReadConditionParams, ReadConditionResult>(
      methods.readCondition,
      { text },
    );
  }

  private synced(): VersionedTextDocumentIdentifier {
    this.client.sync();
    const file = this.client.workspace.getFile(this.uri);

    if (file === null) throw new Error(`${this.uri} is not open`);

    return { uri: this.uri, version: file.version };
  }
}
