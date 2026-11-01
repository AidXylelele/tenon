import { GetConformanceStatement } from '../../../../../src/application/automation/workflows/get-conformance-statement.js';

describe('GetConformanceStatement', () => {
  it('the_statement_names_the_supported_subset_and_what_it_excludes', () => {
    const statement = new GetConformanceStatement().execute();

    expect(statement.dsl).toEqual(['1.0.0', '1.0.1', '1.0.2', '1.0.3']);
    expect(statement.calls).toEqual(['http', 'openapi']);
    expect(statement.runs).toEqual(['workflow', 'script', 'shell']);
    expect(statement.scriptLanguages).toEqual(['js', 'python']);
    expect(statement.excluded).toContain('the wait task');
    expect(statement.excluded).toContain('use.secrets');
    expect(statement.contradictions).toHaveLength(2);
  });
});
