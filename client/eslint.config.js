import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // dist is the build output and coverage is the generated test-coverage report. Neither is
  // our code, so linting them only produces noise.
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // This rule flags the usual "load data when the page opens" effect
    // (useEffect(() => { loadItems(); }, [])) because the loader sets state as it starts.
    // That pattern is correct and every page here uses it on purpose, so the rule is off
    // for the app code instead of rewriting working pages to satisfy a style preference.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // AuthContext.tsx exports both the AuthProvider component and the useAuth hook. That only
    // affects hot reload while developing (the page reloads fully instead of patching in
    // place), so it is allowed for the context folder.
    files: ['src/context/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])