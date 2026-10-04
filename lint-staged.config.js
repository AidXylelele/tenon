// Files inside apps/* are handled by the closest lint-staged config in that app.
const config = {
  '*': 'prettier --write --ignore-unknown',
};

export default config;
