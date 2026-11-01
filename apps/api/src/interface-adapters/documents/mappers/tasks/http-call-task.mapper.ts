import type {
  JsonObject,
  TaskProps,
} from '../../../../domain/automation/language/interfaces.js';
import type { ReusableComponents } from '../../../../domain/automation/language/reusable-components.js';
import { HttpCallTask } from '../../../../domain/automation/language/tasks/http-call-task.js';
import type * as Dsl from '../../interfaces.js';
import { EndpointMapper } from '../endpoint.mapper.js';
import { CallOutputMapper } from '../call-output.mapper.js';
import { TemplateMapper } from '../template.mapper.js';

export class HttpCallTaskMapper {
  static toDomain(
    node: Dsl.HttpArguments,
    props: TaskProps,
    components: ReusableComponents,
  ): HttpCallTask {
    const argumentsAt = props.reference.at('with');
    const endpointAt = argumentsAt.at('endpoint');
    const endpoint = EndpointMapper.toDomain(
      node.endpoint,
      endpointAt,
      components,
    );
    const request: JsonObject = {
      method: node.method,
      headers: node.headers,
      body: node.body,
      query: node.query,
      output: node.output,
      redirect: node.redirect,
    };
    const args = TemplateMapper.toDomain(request, argumentsAt);
    const output = CallOutputMapper.toDomain(
      node.output,
      node.redirect,
      argumentsAt,
    );
    return new HttpCallTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      endpoint,
      arguments: args,
      output,
    });
  }
}
