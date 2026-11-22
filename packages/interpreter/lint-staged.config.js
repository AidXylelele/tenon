const config = {
  "*.{ts,js}": ["eslint --fix", "prettier --write", "vitest related --run"],
  "*.{json,md,yaml}": "prettier --write",
};

export default config;
