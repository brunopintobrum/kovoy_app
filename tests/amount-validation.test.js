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
process.env.DB_PATH = path.join(os.tmpdir(), `orlando-test-amounts-${Date.now()}.db`);

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

const createGroup = async (baseUrl, jar) => {
    const res = await fetch(`${baseUrl}/api/groups`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': jar.csrf_token,
            Cookie: jarToHeader(jar)
        },
        body: JSON.stringify({ name: 'Test Group', defaultCurrency: 'USD' })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    return body.groupId;
};

describe('Amount validation', () => {
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

    test('reject negative amount in expense', async () => {
        const password = 'StrongPass!123';
        const email = `test-${Date.now()}@example.com`;

        await registerUser(baseUrl, email, password);
        const jar = await loginUser(baseUrl, email, password);
        await ensureCsrf(baseUrl, jar);
        const groupId = await createGroup(baseUrl, jar);

        const participantRes = await fetch(`${baseUrl}/api/groups/${groupId}/participants`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': jar.csrf_token,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                displayName: 'Test Participant',
                type: 'adult'
            })
        });
        expect(participantRes.status).toBe(200);
        const participantBody = await participantRes.json();
        const participantId = participantBody.participantId || participantBody.id;

        const res = await fetch(`${baseUrl}/api/groups/${groupId}/expenses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': jar.csrf_token,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                description: 'Test Expense',
                amount: -100,
                currency: 'USD',
                date: new Date().toISOString(),
                payerParticipantId: participantId,
                splitType: 'participants',
                splitMode: 'equal',
                participantIds: [participantId]
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('greater than zero');
    });

    test('reject zero amount in expense', async () => {
        const password = 'StrongPass!123';
        const email = `test-zero-${Date.now()}@example.com`;

        await registerUser(baseUrl, email, password);
        const jar = await loginUser(baseUrl, email, password);
        await ensureCsrf(baseUrl, jar);
        const groupId = await createGroup(baseUrl, jar);

        const participantRes = await fetch(`${baseUrl}/api/groups/${groupId}/participants`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': jar.csrf_token,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                displayName: 'Test Participant',
                type: 'adult'
            })
        });
        expect(participantRes.status).toBe(200);
        const participantBody = await participantRes.json();
        const participantId = participantBody.participantId || participantBody.id;

        const res = await fetch(`${baseUrl}/api/groups/${groupId}/expenses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': jar.csrf_token,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                description: 'Test Expense',
                amount: 0,
                currency: 'USD',
                date: new Date().toISOString(),
                payerParticipantId: participantId,
                splitType: 'participants',
                splitMode: 'equal',
                participantIds: [participantId]
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('greater than zero');
    });

    test('reject amount exceeding maximum', async () => {
        const password = 'StrongPass!123';
        const email = `test-max-${Date.now()}@example.com`;

        await registerUser(baseUrl, email, password);
        const jar = await loginUser(baseUrl, email, password);
        await ensureCsrf(baseUrl, jar);
        const groupId = await createGroup(baseUrl, jar);

        const participantRes = await fetch(`${baseUrl}/api/groups/${groupId}/participants`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': jar.csrf_token,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                displayName: 'Test Participant',
                type: 'adult'
            })
        });
        expect(participantRes.status).toBe(200);
        const participantBody = await participantRes.json();
        const participantId = participantBody.participantId || participantBody.id;

        const res = await fetch(`${baseUrl}/api/groups/${groupId}/expenses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': jar.csrf_token,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                description: 'Test Expense',
                amount: 1000000,
                currency: 'USD',
                date: new Date().toISOString(),
                payerParticipantId: participantId,
                splitType: 'participants',
                splitMode: 'equal',
                participantIds: [participantId]
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('must not exceed');
    });

    test('accept valid positive amounts', async () => {
        const password = 'StrongPass!123';
        const email = `test-valid-${Date.now()}@example.com`;

        await registerUser(baseUrl, email, password);
        const jar = await loginUser(baseUrl, email, password);
        await ensureCsrf(baseUrl, jar);
        const groupId = await createGroup(baseUrl, jar);

        const participantRes = await fetch(`${baseUrl}/api/groups/${groupId}/participants`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': jar.csrf_token,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                displayName: 'Test Participant',
                type: 'adult'
            })
        });
        expect(participantRes.status).toBe(200);
        const participantBody = await participantRes.json();
        const participantId = participantBody.participantId || participantBody.id;

        const validAmounts = [0.01, 50, 100.50, 999999.99];

        for (const amount of validAmounts) {
            const res = await fetch(`${baseUrl}/api/groups/${groupId}/expenses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': jar.csrf_token,
                    Cookie: jarToHeader(jar)
                },
                body: JSON.stringify({
                    description: `Test Expense ${amount}`,
                    amount,
                    currency: 'USD',
                    date: new Date().toISOString(),
                    payerParticipantId: participantId,
                    splitType: 'participants',
                    splitMode: 'equal',
                    participantIds: [participantId]
                })
            });

            const body = await res.json();
            if (res.status !== 200) {
                console.log(`Failed for amount ${amount}: ${body.error}`);
            }
            expect(res.status).toBe(200);
            expect(body.ok).toBe(true);
        }
    });
});
