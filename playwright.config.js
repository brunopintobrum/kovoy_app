const path = require('path');
const { defineConfig } = require('playwright/test');

const baseURL = 'http://127.0.0.1:3000';

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 60000, // Aumentado para 60s (testes E2E completos precisam mais tempo)
    expect: {
        timeout: 10000 // Aumentado para 10s (mais tolerante no CI)
    },
    retries: process.env.CI ? 1 : 0,
    use: {
        baseURL,
        headless: true,
        viewport: { width: 1280, height: 720 }
    },
    webServer: {
        command: 'node e2e/webserver.js',
        url: `${baseURL}/login`,
        reuseExistingServer: false,
        env: {
            NODE_ENV: 'test',
            PORT: '3000',
            JWT_SECRET: 'playwright-test-secret',
            EMAIL_VERIFICATION_REQUIRED: 'false',
            TWO_FACTOR_REQUIRED: 'false',
            APP_BASE_URL: baseURL,
            SMTP_HOST: ''
        }
    }
});
