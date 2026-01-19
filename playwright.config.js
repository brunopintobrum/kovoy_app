const path = require('path');
const { defineConfig } = require('playwright/test');

const baseURL = 'http://127.0.0.1:3000';

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 30000,
    expect: {
        timeout: 5000
    },
    retries: process.env.CI ? 1 : 0,
    use: {
        baseURL,
        headless: true,
        viewport: { width: 1280, height: 720 }
    },
    globalSetup: require.resolve('./e2e/global-setup'),
    webServer: {
        command: 'node server.js',
        url: `${baseURL}/login`,
        reuseExistingServer: false,
        env: {
            NODE_ENV: 'test',
            PORT: '3000',
            JWT_SECRET: 'playwright-test-secret',
            EMAIL_VERIFICATION_REQUIRED: 'false',
            TWO_FACTOR_REQUIRED: 'false',
            DB_PATH: path.join(__dirname, 'data', 'e2e.db'),
            APP_BASE_URL: baseURL,
            SMTP_HOST: ''
        }
    }
});
