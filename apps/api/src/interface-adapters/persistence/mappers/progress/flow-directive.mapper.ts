import { FlowDirective } from '../../../../domain/automation/language/flow-directive.js';
import { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';
import type { FlowDirectiveState } from '../../interfaces.js';

export class FlowDirectiveMapper {
  static toState(directive: FlowDirective | null): FlowDirectiveState | null {
    if (directive === null) return null;

    const pointer = directive.pointer?.tokens ?? null;
    return { name: directive.name, pointer };
  }

  static toDomain(state: FlowDirectiveState | null): FlowDirective | null {
    if (state === null) return null;

    const tokens = state.pointer ?? [];
    const at = new JsonPointer(tokens);
    return FlowDirective.named(state.name, at);
  }
}
