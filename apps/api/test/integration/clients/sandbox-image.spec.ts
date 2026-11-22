import { GenericContainer, type StartedTestContainer } from "testcontainers";
import shellPlatform from "../../../src/frameworks/go-judge/shell-platform.json" with { type: "json" };

const IMAGE = process.env.SANDBOX_IMAGE ?? "";
const PATH = "/usr/local/bin /usr/bin /bin";
const UNUSABLE = [
  "apt(-.*)?",
  "dpkg(-.*)?",
  "debconf(-.*)?",
  "deb-systemd-.*",
  "update-alternatives",
  "docker-entrypoint\\.sh",
  "chage|chfn|chsh|expiry|gpasswd|login|newgrp|passwd|sg|su",
  "mount|umount|nsenter|unshare|dmesg|wall",
].join("|");
const LISTING = [
  `test -x ${shellPlatform.shell} || exit 1`,
  ". /usr/lib/os-release",
  'printf "%s, %s\\n" "$PRETTY_NAME" "$(uname -m)"',
  `for d in ${PATH}; do find -L "$d" -maxdepth 1 -type f -perm -o+x -printf "%f\\n"; done | grep -vxE '${UNUSABLE}' | LC_ALL=C sort -u`,
].join("\n");

describe.skipIf(IMAGE === "")(
  "the sandbox image its shell is documented from",
  () => {
    let container: StartedTestContainer;

    beforeAll(async () => {
      container = await new GenericContainer(IMAGE)
        .withEntrypoint(["/bin/sh", "-c"])
        .withCommand(["sleep infinity"])
        .start();
    });

    afterAll(async () => {
      await container.stop();
    });

    it("runs_the_documented_shell_on_the_documented_platform_with_the_commands_a_sandboxed_script_can_use", async () => {
      const listed = await container.exec(["/bin/sh", "-c", LISTING]);
      const [platform, ...commands] = listed.stdout.trim().split("\n");
      const documented = { platform, shell: shellPlatform.shell, commands };

      expect(listed.exitCode).toBe(0);
      expect(documented).toEqual(shellPlatform);
    });
  },
);
