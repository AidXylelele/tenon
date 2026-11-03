export enum WorkflowStatus {
  Active = 'active',
  Archived = 'archived',
}

// Why a workflow refuses a request; the presentation turns the code into a message.
export enum WorkflowRefusal {
  Archived = 'workflow.archived',
  VersionTaken = 'workflow.version-taken',
}
