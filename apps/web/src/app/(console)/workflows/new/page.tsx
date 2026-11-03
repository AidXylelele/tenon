import type { Metadata } from 'next';
import { WorkflowEditor } from '@/spaces/automation/modules/workflow-editor';

export const metadata: Metadata = { title: 'New workflow' };

export default function NewWorkflowPage() {
  return <WorkflowEditor />;
}
