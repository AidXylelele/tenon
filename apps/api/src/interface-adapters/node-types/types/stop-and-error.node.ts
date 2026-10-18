import { z } from 'zod';
import { CORE_SETTINGS } from '../core-settings.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';
import { NodeUserError } from '../node-user-error.js';

const parameters = z.strictObject({
  message: z.string().min(1).meta({ title: 'Error message' }),
});

type StopAndErrorParameters = z.infer<typeof parameters>;

export class StopAndErrorNode implements NodeType<StopAndErrorParameters> {
  readonly id = 'stopAndError';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Flow';
  readonly displayName = 'Stop and Error';
  readonly description = 'Ends the run as failed with a configured message';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = [];

  outputsFor(): readonly string[] {
    return [];
  }

  execute(run: NodeRun<StopAndErrorParameters>): NodeResult {
    const { message } = run.parameters();
    throw new NodeUserError(message);
  }
}
