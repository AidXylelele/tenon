import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';

describe('JsonPointer', () => {
  it('the_root_is_the_empty_pointer', () => {
    expect(JsonPointer.root().toString()).toBe('');
  });

  it('tokens_escape_tilde_and_slash', () => {
    const pointer = JsonPointer.root().at('do').at(0).at('a/b~c');

    expect(pointer.toString()).toBe('/do/0/a~1b~0c');
  });
});
