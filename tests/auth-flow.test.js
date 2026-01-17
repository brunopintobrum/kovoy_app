/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.EMAIL_VERIFICATION_REQUIRED = 'true';
process.env.TWO_FACTOR_REQUIRED = 'true';
process.env.JWT_SECRET = 'test-secret';
process.env.APP_BASE_URL = 'http://localhost';
process.env.SMTP_HOST = '';
process.env.DB_PATH = path.join(os.tmpdir(), `orlando-test-${Date.now()}.db`);

const { startServer, db, createEmailVerificationToken, createTwoFactorCode } = require('../server');

const getSetCookies = (res) => {
    if (typeof res.headers.getSetCookie === 'function') {
        return res.headers.getSetCookie();
    }
    if (res.headers.raw) {
        const raw = res.headers.raw()['set-cookie'];
        return raw || [];
    }
    const single = res.headers.get('set-cookie');
    return single ? [single] : [];
};

const updateJar = (jar, setCookies) => {
    setCookies.forEach((cookie) => {
        const [pair] = cookie.split(';');
        const [name, value] = pair.split('=');
        jar[name] = value;
    });
};

const jarToHeader = (jar) => {
    return Object.entries(jar)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
};

describe('auth flow', () => {
    let server;
    let baseUrl;

    beforeAll(() => {
        server = startServer(0);
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
    });

    afterAll(() => {
        if (server) {
            server.close();
        }
        try {
            db.close();
        } catch (err) {
            // ignore close errors in tests
        }
        if (process.env.DB_PATH && fs.existsSync(process.env.DB_PATH)) {
            try {
                fs.unlinkSync(process.env.DB_PATH);
            } catch (err) {
                // ignore locked temp db on Windows
            }
        }
    });

    test('register, verify email, login with two-factor', async () => {
        const jar = {};
        const email = `user${Date.now()}@example.com`;
        const password = 'StrongPass!123';
        const displayName = 'Taylor Example';

        const registerRes = await fetch(`${baseUrl}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, displayName })
        });
        expect(registerRes.status).toBe(201);
        const registerBody = await registerRes.json();
        expect(registerBody.emailVerificationRequired).toBe(true);

        const loginRes = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        expect(loginRes.status).toBe(403);
        const loginBody = await loginRes.json();
        expect(loginBody.code).toBe('email_verification_required');

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        expect(user).toBeTruthy();
        expect(user.display_name).toBe(displayName);
        const rawToken = createEmailVerificationToken(user.id);
        const confirmRes = await fetch(`${baseUrl}/confirm-mail?token=${encodeURIComponent(rawToken)}`);
        expect(confirmRes.url).toContain('status=success');

        const loginRes2 = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        expect(loginRes2.status).toBe(202);
        const loginBody2 = await loginRes2.json();
        expect(loginBody2.twoFactorRequired).toBe(true);
        updateJar(jar, getSetCookies(loginRes2));

        const twoStepPage = await fetch(`${baseUrl}/two-step-verification`, {
            headers: { Cookie: jarToHeader(jar) }
        });
        updateJar(jar, getSetCookies(twoStepPage));
        expect(twoStepPage.status).toBe(200);

        const code = createTwoFactorCode(user.id);
        const csrf = jar.csrf_token || '';

        const verifyRes = await fetch(`${baseUrl}/api/two-step/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrf,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({ code })
        });
        expect(verifyRes.status).toBe(200);
        const verifyBody = await verifyRes.json();
        expect(verifyBody.ok).toBe(true);
    });
});
