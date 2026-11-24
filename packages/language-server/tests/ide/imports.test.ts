import { expect, test } from "vitest";
import { importsNeededOf } from "../../src/ide/imports/index.js";
import { catalogsHeader } from "../support/documents.js";
import { snapshotOf } from "../support/snapshot.js";

const defaultCatalogFlow = `${catalogsHeader}do:
  - log:
      call: log:1.0.0@default
      with:
        message: hello
`;

test("an import with no URI is not asked", () => {
  const analysis = snapshotOf(defaultCatalogFlow).analysis;

  const needed = importsNeededOf(analysis);

  expect(needed).toEqual([]);
});
