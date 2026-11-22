import { catalogFunctionPathOf } from "../../standard/index.js";
import type { CatalogReference } from "./types.js";

const githubTree = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/(.+)$/;
const githubRepository =
  /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/;
const gitlabTree = /\/-\/tree\//;
const trailingSlashes = /\/+$/;

export function functionUriOf(
  root: string,
  reference: CatalogReference,
): string {
  const raw = rawRootOf(root);
  const base = raw.replace(trailingSlashes, "");
  const path = catalogFunctionPathOf(reference.name, reference.version);

  return `${base}/${path}`;
}

function rawRootOf(root: string): string {
  const tree = githubTree.test(root);
  const repository = githubRepository.test(root);

  if (tree) {
    return root.replace(
      githubTree,
      "https://raw.githubusercontent.com/$1/$2/refs/heads/$3",
    );
  }

  if (repository) {
    return root.replace(
      githubRepository,
      "https://raw.githubusercontent.com/$1/$2/refs/heads/main",
    );
  }

  return root.replace(gitlabTree, "/-/raw/");
}
