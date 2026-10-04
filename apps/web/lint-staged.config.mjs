const config = {
  '*.{js,mjs,cjs,ts,mts,cts,tsx}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
    'prettier --write',
  ],
  '*.{json,md,css,yml,yaml}': 'prettier --write',
};

export default config;
