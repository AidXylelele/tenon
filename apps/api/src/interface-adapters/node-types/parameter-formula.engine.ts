import { FormulaEngine } from '../../application/interfaces.js';
import type { NodeParameters, NodeRename } from '../../domain/interfaces.js';
import { ParameterTree } from './parameters/parameter-tree.js';

export class ParameterFormulaEngine extends FormulaEngine {
  renameNodes(
    parameters: NodeParameters,
    renames: readonly NodeRename[],
  ): NodeParameters {
    const names = new Map<string, string>();

    for (const rename of renames) {
      names.set(rename.from, rename.to);
    }

    return ParameterTree.parse(parameters).renameNodes(names);
  }
}
