/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.EMAIL_VERIFICATION_REQUIRED = 'false';
process.env.TWO_FACTOR_REQUIRED = 'false';
process.env.SMTP_HOST = '';
process.env.DB_PATH = path.join(os.tmpdir(), `orlando-test-iso4217-${Date.now()}.db`);

const { startServer, db } = require('../server');

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

const registerUser = async (baseUrl, email, password) => {
    const res = await fetch(`${baseUrl}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            firstName: 'Test',
            lastName: 'User',
            password,
            confirmPassword: password
        })
    });
    expect(res.status).toBe(201);
};

const loginUser = async (baseUrl, email, password) => {
    const jar = {};
    const res = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    expect(res.status).toBe(200);
    updateJar(jar, getSetCookies(res));
    return jar;
};

const ensureCsrf = async (baseUrl, jar) => {
    const res = await fetch(`${baseUrl}/groups`, {
        headers: { Cookie: jarToHeader(jar) }
    });
    updateJar(jar, getSetCookies(res));
    expect(res.status).toBe(200);
};

describe('ISO 4217 currency validation', () => {
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

    test('accept valid ISO 4217 currency code', async () => {
        const password = 'StrongPass!123';
        const email = `test-${Date.now()}@example.com`;

        await registerUser(baseUrl, email, password);
        const jar = await loginUser(baseUrl, email, password);
        await ensureCsrf(baseUrl, jar);

        const res = await fetch(`${baseUrl}/api/groups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': jar.csrf_token,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                name: 'Test Group',
                defaultCurrency: 'EUR'
            })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.groupId).toBeTruthy();
    });

    test('reject invalid ISO 4217 currency code', async () => {
        const password = 'StrongPass!123';
        const email = `test2-${Date.now()}@example.com`;

        await registerUser(baseUrl, email, password);
        const jar = await loginUser(baseUrl, email, password);
        await ensureCsrf(baseUrl, jar);

        const res = await fetch(`${baseUrl}/api/groups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': jar.csrf_token,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                name: 'Test Group',
                defaultCurrency: 'XYZ'
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('ISO 4217');
    });

    test('accept multiple valid currency codes', async () => {
        const password = 'StrongPass!123';
        const email = `test3-${Date.now()}@example.com`;

        await registerUser(baseUrl, email, password);
        const jar = await loginUser(baseUrl, email, password);
        await ensureCsrf(baseUrl, jar);

        const validCurrencies = ['USD', 'BRL', 'GBP', 'JPY', 'AUD'];

        for (const currency of validCurrencies) {
            const res = await fetch(`${baseUrl}/api/groups`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': jar.csrf_token,
                    Cookie: jarToHeader(jar)
                },
                body: JSON.stringify({
                    name: `Group ${currency}`,
                    defaultCurrency: currency
                })
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.ok).toBe(true);
        }
    });
});
