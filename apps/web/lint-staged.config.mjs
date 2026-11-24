const config = {
  "*.{ts,tsx,mts,mjs}": [
    "eslint --fix",
    "prettier --write",
    "vitest related --run",
  ],
  "*.{css,json,md}": "prettier --write",
};

export default config;
