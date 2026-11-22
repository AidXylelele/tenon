import { SecretRefusal } from "../../../../../src/domain/automation/secrets/enums.js";
import { Secret } from "../../../../../src/domain/automation/secrets/secret.js";

const now = new Date("2026-11-19T10:00:00.000Z");
const later = new Date("2026-11-19T11:00:00.000Z");

function aSecret(value: string) {
  return Secret.create({ ownerId: "owner-1", name: "crm", value, now });
}

describe("Secret", () => {
  it("a_refused_value_refuses_the_secret_and_its_replacement_keeps_the_old_value", () => {
    const refused = aSecret("abc");
    const created = aSecret("long-enough");

    if (!created.ok) throw new Error(created.failure);

    const replaced = created.value.replace("abc", later);

    expect(refused).toEqual({ ok: false, failure: SecretRefusal.TooShort });
    expect(replaced).toEqual({ ok: false, failure: SecretRefusal.TooShort });
    expect(created.value.value.text).toBe("long-enough");
    expect(created.value.updatedAt).toEqual(now);
  });

  it("a_replacement_is_used_from_then_on", () => {
    const created = aSecret("long-enough");

    if (!created.ok) throw new Error(created.failure);

    const replaced = created.value.replace("next", later);

    expect(replaced).toEqual({ ok: true, value: undefined });
    expect(created.value.value.text).toBe("next");
    expect(created.value.updatedAt).toEqual(later);
  });
});
