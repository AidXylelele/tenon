import { InvitationToken } from '../../../src/domain/invitation-token.js';

describe('InvitationToken', () => {
  it('generated_tokens_are_unique_and_safe_to_put_in_a_url', () => {
    const first = InvitationToken.generate();
    const second = InvitationToken.generate();
    expect(first.value).not.toBe(second.value);
    expect(first.value).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.value.length).toBeGreaterThanOrEqual(32);
  });

  it('a_token_read_back_from_a_link_has_the_same_fingerprint_as_the_issued_one', () => {
    const issued = InvitationToken.generate();
    const received = new InvitationToken(issued.value);
    expect(received.hash).toBe(issued.hash);
  });

  it('the_fingerprint_differs_between_tokens_and_does_not_contain_the_value', () => {
    const token = InvitationToken.generate();
    expect(InvitationToken.generate().hash).not.toBe(token.hash);
    expect(token.hash).not.toContain(token.value);
  });
});
