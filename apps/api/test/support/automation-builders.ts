import { OnError, TriggerType } from '../../src/domain/enums.js';
import { Graph } from '../../src/domain/graph.js';
import type {
  ConnectionProps,
  NodeProps,
  NodeSettings,
} from '../../src/domain/interfaces.js';

export const defaultSettings = (
  overrides: Partial<NodeSettings> = {},
): NodeSettings => ({
  alwaysOutputData: false,
  executeOnce: false,
  retry: { attempts: 1, waitMs: 0 },
  onError: OnError.Stop,
  ...overrides,
});

export const aNode = (
  id: string,
  overrides: Partial<NodeProps> = {},
): NodeProps => ({
  id,
  name: id,
  type: 'noOp',
  typeVersion: 1,
  trigger: null,
  parameters: {},
  credentialId: null,
  settings: defaultSettings(),
  position: { x: 0, y: 0 },
  note: null,
  disabled: false,
  ...overrides,
});

export const aTrigger = (
  id: string,
  overrides: Partial<NodeProps> = {},
): NodeProps =>
  aNode(id, {
    type: 'manualTrigger',
    trigger: TriggerType.Manual,
    ...overrides,
  });

export const link = (
  from: string,
  to: string,
  output = 'main',
  input = 'main',
): ConnectionProps => ({ from, output, to, input });

export const aGraph = (
  nodes: NodeProps[],
  connections: ConnectionProps[] = [],
): Graph => new Graph({ nodes, connections });
