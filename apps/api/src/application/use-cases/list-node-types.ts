import type { NodeTypeCatalog, NodeTypeEntry } from '../interfaces.js';

export class ListNodeTypes {
  constructor(private readonly catalogue: NodeTypeCatalog) {}

  execute(): NodeTypeEntry[] {
    return this.catalogue.list();
  }
}
