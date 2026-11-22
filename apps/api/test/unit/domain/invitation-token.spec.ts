import { InvitationToken } from "../../../src/domain/identity/invitations/invitation-token.js";

describe("InvitationToken", () => {
  it("a_generated_token_is_safe_in_a_url_and_at_least_32_characters_long", () => {
    const token = InvitationToken.generate();

    expect(token.value).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.value.length).toBeGreaterThanOrEqual(32);
  });

  it("a_token_read_back_from_a_link_has_the_same_fingerprint_as_the_issued_one", () => {
    const issued = InvitationToken.generate();

    const received = new InvitationToken(issued.value);

    expect(received.hash).toBe(issued.hash);
  });

  it("the_fingerprint_does_not_contain_the_token", () => {
    const token = InvitationToken.generate();

    expect(token.hash).not.toContain(token.value);
  });
});
