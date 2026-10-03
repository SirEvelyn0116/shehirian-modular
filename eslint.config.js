// ESLint flat config. Rules: ESLint's own `recommended` set, plus
// react-hooks' `recommended` set for the React admin app. Each area of the
// repo gets the globals of the environment it actually runs in.
const js = require('@eslint/js');
const globals = require('globals');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '**/node_modules/**',
      'admin/recipes-dist/**',
      'playwright-report/**',
      'test-results/**',
      '.netlify/**',
      'recipes-app/.netlify/**',
    ],
  },
  js.configs.recommended,
  {
    // Node: functions, build scripts, db scripts, tests.
    files: ['**/*.js'],
    languageOptions: { sourceType: 'commonjs', ecmaVersion: 2022, globals: { ...globals.node } },
    rules: {
      // An unused `catch (e)` binding is not flagged (the pre-v9 default).
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
  {
    // Browser scripts loaded by the site and the admin page.
    files: [
      'sections/**/*.js',
      'assets/**/*.js',
      'admin/**/*.js',
      'preview.js',
      'tests/support/fake-identity-widget.js',
    ],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Shared between <script> tags: provided by the Netlify Identity
        // widget, and by sections/*/render.js for preview.js.
        netlifyIdentity: 'readonly',
        renderHero: 'readonly',
        renderAboutUs: 'readonly',
        renderOurCompanies: 'readonly',
        renderRecipes: 'readonly',
        renderContactUs: 'readonly',
      },
    },
    rules: {
      // Top-level functions in these scripts are globals called from other
      // scripts or from onclick="" attributes, so only locals are checked.
      'no-unused-vars': ['error', { vars: 'local', caughtErrors: 'none' }],
      'no-redeclare': ['error', { builtinGlobals: false }],
    },
  },
  {
    // React admin app (ES modules, bundled by Vite).
    files: ['recipes-app/src/**/*.{js,jsx}'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Without the React plugin, ESLint cannot see that a capitalized
      // import is used as <Component />; treat those as used.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z]', caughtErrors: 'none' }],
    },
  },
  {
    files: ['recipes-app/vite.config.js'],
    languageOptions: { sourceType: 'module' },
  },
];
