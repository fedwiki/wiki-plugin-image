import globals from 'globals'
import pluginJs from '@eslint/js'

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ['client/image.js'] },
  pluginJs.configs.recommended,
  {
    files: ['src/*.js', 'client/gallery.js'],
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
    files: ['server/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node,
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
