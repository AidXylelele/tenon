import { expect, test } from "vitest";
import { problemsOf } from "../../src/ide/snapshot/index.js";
import { inlineHeader } from "../support/documents.js";
import { snapshotOf } from "../support/snapshot.js";

const posted = `${inlineHeader}do:
  - post:
      set:
        message: 'New digest: \${ .title }'
        whole: \${ .title }
  - count:
      run:
        script:
          language: js
          code: |
            console.log(\`\${1 + 1}\`);
`;

test("a reference written inside a text warns that it is sent as text", () => {
  const problems = problemsOf(snapshotOf(posted));

  const written = problems.filter((each) => each.code === "written-reference");

  const [only] = written;
  expect(written).toHaveLength(1);
  expect(only).toMatchObject({
    code: "written-reference",
    message:
      "This ${ … } is inside other text, so it is sent as written, not as data. Use Insert data to put data here.",
    pointer: "/do/0/post/set/message",
    subject: "New digest: ${ .title }",
  });
  expect(only?.range).not.toBeNull();
});
