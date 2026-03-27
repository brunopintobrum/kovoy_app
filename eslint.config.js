const globals = require('globals');
const js = require('@eslint/js');

module.exports = [
    js.configs.recommended,
    // server.js — regras estritas
    {
        files: ['server.js'],
        languageOptions: { globals: { ...globals.node } },
        rules: {
            'no-unused-vars': 'warn',
            'no-console': 'off',
            'eqeqeq': 'error',
            'no-var': 'error',
            'no-control-regex': 'off',
        },
    },
    // Scripts auxiliares e configs — regras mais relaxadas
    {
        files: ['eslint.config.js', 'playwright.config.js', 'scripts/**'],
        languageOptions: { globals: { ...globals.node } },
        rules: {
            'no-unused-vars': 'warn',
            'no-console': 'off',
            'eqeqeq': 'warn',
            'no-var': 'warn',
            'no-useless-escape': 'warn',
            'no-useless-assignment': 'warn',
        },
    },
    // Testes Jest (jsdom: tem window/document E node)
    {
        files: ['tests/**'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
                ...globals.jest,
            },
        },
        rules: {
            'no-unused-vars': 'warn',
            'no-console': 'off',
            'eqeqeq': 'error',
            'no-var': 'error',
        },
    },
    // Código frontend próprio
    {
        files: ['public/*.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
                bootstrap: 'readonly',
                showToast: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': 'warn',
            'eqeqeq': 'warn',
            'no-var': 'warn',
            'no-cond-assign': 'warn',
            'no-useless-escape': 'warn',
            'no-useless-assignment': 'warn',
            'no-empty': 'warn',
        },
    },
    {
        ignores: [
            'node_modules',
            'playwright-report',
            'test-results',
            'e2e',
            'public/assets/**',
            'cloudflare/**',
        ],
    },
];
