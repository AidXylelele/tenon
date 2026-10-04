const config = {
  '*.{js,mjs,cjs,ts,mts,cts}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
    'prettier --write',
  ],
  '*.{json,md,yml,yaml}': 'prettier --write',
};

export default config;
