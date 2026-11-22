import type { LSPClient } from "@codemirror/lsp-client";
import {
  type DocumentParams,
  type DocumentResult,
  type EditAction,
  type EditParams,
  type EditResult,
  methods,
  type RangesOfParams,
  type RangesOfResult,
  type StepFormParams,
  type StepFormResult,
  type StructureParams,
  type StructureResult,
  type WorkflowFormParams,
  type WorkflowFormResult,
} from "language-server/protocol";
import type { VersionedTextDocumentIdentifier } from "vscode-languageserver-protocol";

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

  private synced(): VersionedTextDocumentIdentifier {
    this.client.sync();
    const file = this.client.workspace.getFile(this.uri);

    if (file === null) throw new Error(`${this.uri} is not open`);

    return { uri: this.uri, version: file.version };
  }
}
