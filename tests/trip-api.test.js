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
process.env.DB_PATH = path.join(os.tmpdir(), `orlando-test-trip-${Date.now()}.db`);

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

const registerAndLogin = async (baseUrl) => {
    const email = `trip${Date.now()}@example.com`;
    const password = 'StrongPass!123';
    const jar = {};

    const registerRes = await fetch(`${baseUrl}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            firstName: 'Trip',
            lastName: 'User',
            password,
            confirmPassword: password
        })
    });
    expect(registerRes.status).toBe(201);

    const loginRes = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    expect(loginRes.status).toBe(200);
    updateJar(jar, getSetCookies(loginRes));

    const shellRes = await fetch(`${baseUrl}/dashboard`, {
        headers: { Cookie: jarToHeader(jar) }
    });
    updateJar(jar, getSetCookies(shellRes));
    expect(shellRes.status).toBe(200);

    return jar;
};

describe('trip api', () => {
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

    test('rejects unauthenticated access', async () => {
        const res = await fetch(`${baseUrl}/api/trip`);
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('Not authenticated.');
    });

    test('rejects write without csrf token', async () => {
        const jar = await registerAndLogin(baseUrl);
        const res = await fetch(`${baseUrl}/api/trip/flights`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                airline: 'Test Airline',
                from: 'MCO',
                to: 'JFK',
                departAt: '2026-02-22T10:00:00Z',
                arriveAt: '2026-02-22T14:00:00Z',
                currency: 'USD',
                cost: 300
            })
        });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe('CSRF validation failed.');
    });

    test('creates and lists flights with csrf token', async () => {
        const jar = await registerAndLogin(baseUrl);
        const csrf = jar.csrf_token;

        const createRes = await fetch(`${baseUrl}/api/trip/flights`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrf,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                airline: 'Test Airline',
                from: 'MCO',
                to: 'JFK',
                departAt: '2026-02-22T10:00:00Z',
                arriveAt: '2026-02-22T14:00:00Z',
                currency: 'USD',
                cost: 300
            })
        });
        expect(createRes.status).toBe(200);
        const createBody = await createRes.json();
        expect(createBody.ok).toBe(true);
        expect(createBody.id).toBeTruthy();

        const listRes = await fetch(`${baseUrl}/api/trip/flights`, {
            headers: { Cookie: jarToHeader(jar) }
        });
        expect(listRes.status).toBe(200);
        const listBody = await listRes.json();
        expect(listBody.data).toHaveLength(1);
        expect(listBody.data[0]).toMatchObject({
            airline: 'Test Airline',
            from: 'MCO',
            to: 'JFK',
            currency: 'USD',
            cost: 300
        });
    });

    test('updates trip meta with csrf token', async () => {
        const jar = await registerAndLogin(baseUrl);
        const csrf = jar.csrf_token;

        const updateRes = await fetch(`${baseUrl}/api/trip/meta`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrf,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                name: 'Kovoy Trip',
                base: 'Orlando'
            })
        });
        expect(updateRes.status).toBe(200);

        const metaRes = await fetch(`${baseUrl}/api/trip/meta`, {
            headers: { Cookie: jarToHeader(jar) }
        });
        const metaBody = await metaRes.json();
        expect(metaBody.data).toMatchObject({
            name: 'Kovoy Trip',
            base: 'Orlando'
        });
    });
});
