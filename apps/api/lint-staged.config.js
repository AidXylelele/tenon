const config = {
  "*.ts": [
    "eslint --fix",
    "prettier --write",
    "vitest related --run --project unit",
  ],
  "*.{js,mjs,cjs,json,md,yml,yaml}": "prettier --write",
};

export default config;
