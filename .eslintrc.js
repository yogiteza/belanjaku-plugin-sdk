module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    // The host contract and GraphQL schema use snake_case (runtime_key,
    // scope_type, ...) — this isn't a style choice we control.
    camelcase: 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    'no-console': 'off',
  },
  ignorePatterns: ['dist/', 'node_modules/', 'examples/**/dist/'],
  overrides: [
    {
      files: ['src/__tests__/**/*.ts'],
      rules: {
        // Tests reach into `window` and mock fetch args with loose shapes —
        // full typing there would obscure the tests, not clarify them.
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
