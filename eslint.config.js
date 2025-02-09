import globals from 'globals'
import pluginJs from '@eslint/js'

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ['client/**'] },
  pluginJs.configs.recommended,
  {
    files: ['src/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        wiki: 'writable',
        isOwner: 'readonly',
        ...globals.browser,
        ...globals.jquery,
      },
    },
  },
  {
    files: ['scripts/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['scripts/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
]
