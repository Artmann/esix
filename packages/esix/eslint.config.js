import tseslint from 'typescript-eslint'

export default tseslint.config({
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      ecmaVersion: 2018,
      sourceType: 'module'
    }
  },
  plugins: {
    '@typescript-eslint': tseslint.plugin
  },
  rules: {
    ...tseslint.configs.recommended.rules,
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off'
  }
})
