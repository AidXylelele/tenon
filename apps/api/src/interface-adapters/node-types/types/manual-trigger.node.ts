import { z } from 'zod';
import { TriggerType } from '../../../domain/enums.js';
import { CORE_SETTINGS } from '../core-settings.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';

const parameters = z.strictObject({});

type ManualTriggerParameters = z.infer<typeof parameters>;

export class ManualTriggerNode implements NodeType<ManualTriggerParameters> {
  readonly id = 'manualTrigger';
  readonly version = 1;
  readonly kind = 'trigger';
  readonly trigger = TriggerType.Manual;
  readonly category = 'Triggers';
  readonly displayName = 'Manual Trigger';
  readonly description =
    'Starts a test run or a run of a release with the items the caller supplies';
  readonly parameters = parameters;
  readonly inputs = [];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = [];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<ManualTriggerParameters>): NodeResult {
    return { main: run.items };
  }
}
