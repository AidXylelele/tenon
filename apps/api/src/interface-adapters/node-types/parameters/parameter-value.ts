import type { ResolutionContext } from './resolution-context.js';

export interface ParameterValue {
  readonly path: string;
  readonly isDynamic: boolean;
  resolve(context: ResolutionContext): unknown;
  sketch(): unknown;
  leaves(): ParameterValue[];
  renameNodes(names: ReadonlyMap<string, string>): unknown;
}
