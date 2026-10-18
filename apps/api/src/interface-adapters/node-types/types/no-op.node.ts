import { z } from 'zod';
import { CORE_SETTINGS } from '../core-settings.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';

const parameters = z.strictObject({});

type NoOpParameters = z.infer<typeof parameters>;

export class NoOpNode implements NodeType<NoOpParameters> {
  readonly id = 'noOp';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Flow';
  readonly displayName = 'No Operation';
  readonly description = 'Passes items through unchanged';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = [];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<NoOpParameters>): NodeResult {
    return { main: run.items };
  }
}
