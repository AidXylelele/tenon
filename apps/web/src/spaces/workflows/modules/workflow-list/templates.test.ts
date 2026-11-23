import { createInterpreter, type HostProfile } from "interpreter";
import { describe, expect, it } from "vitest";
import { TEMPLATE_SOURCES } from "./template-sources";
import { TEMPLATES } from "./templates";

const PROFILE: HostProfile = {
  effects: ["http", "listen", "emit", "timer"],
  authentications: [],
  processes: [],
  scriptLanguages: [],
  asyncApiProtocols: [],
  mcpTransports: [],
  schedules: ["every", "cron", "after", "on"],
  grants: [],
  secrets: [],
};

describe("the templates a newcomer starts from", () => {
  it("are_five", () => {
    expect(TEMPLATES).toHaveLength(5);
  });

  it.each(TEMPLATES.map((template) => [template.id, template] as const))(
    "%s_compiles_with_the_interpreter_and_names_itself",
    async (_id, template) => {
      const interpreter = await createInterpreter();
      const source = TEMPLATE_SOURCES[template.id] ?? "";

      const compilation = interpreter.compile(source, {
        profile: PROFILE,
        imports: {},
      });

      expect(compilation.kind).toBe("compiled");
      expect(source).toContain(`name: ${template.id}`);
      expect(source).toContain(`namespace: ${template.namespace}`);
    },
  );
});
