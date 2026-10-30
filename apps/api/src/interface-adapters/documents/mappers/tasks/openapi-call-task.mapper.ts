import type {
  JsonObject,
  TaskProps,
} from '../../../../domain/automation/language/interfaces.js';
import type { ReusableComponents } from '../../../../domain/automation/language/reusable-components.js';
import { OpenApiCallTask } from '../../../../domain/automation/language/tasks/openapi-call-task.js';
import type * as Dsl from '../../interfaces.js';
import { EndpointMapper } from '../endpoint.mapper.js';
import { ReferenceableAuthenticationMapper } from '../referenceable-authentication.mapper.js';
import { TemplateMapper } from '../template.mapper.js';

export class OpenApiCallTaskMapper {
  static toDomain(
    node: Dsl.OpenApiArguments,
    props: TaskProps,
    components: ReusableComponents,
  ): OpenApiCallTask {
    const argumentsAt = props.reference.at('with');
    const documentAt = argumentsAt.at('document').at('endpoint');
    const document = EndpointMapper.toDomain(
      node.document.endpoint,
      documentAt,
      components,
    );
    const authenticationAt = argumentsAt.at('authentication');
    const authentication = ReferenceableAuthenticationMapper.toDomain(
      node.authentication,
      authenticationAt,
      components,
    );
    const request: JsonObject = {
      operationId: node.operationId,
      parameters: node.parameters,
      output: node.output,
      redirect: node.redirect,
    };
    const args = TemplateMapper.toDomain(request, argumentsAt);
    return new OpenApiCallTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      document,
      arguments: args,
      authentication,
    });
  }
}
