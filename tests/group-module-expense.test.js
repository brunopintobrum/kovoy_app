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
process.env.DB_PATH = path.join(os.tmpdir(), `orlando-test-module-expense-${Date.now()}.db`);

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
    const email = `module${Date.now()}@example.com`;
    const password = 'StrongPass!123';
    const jar = {};

    const registerRes = await fetch(`${baseUrl}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            firstName: 'Module',
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

describe('group modules with linked expense', () => {
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

    test('creates a ticket and linked expense', async () => {
        const jar = await registerAndLogin(baseUrl);
        const csrf = jar.csrf_token;

        const groupRes = await fetch(`${baseUrl}/api/groups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrf,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({ name: 'Module Group', defaultCurrency: 'USD' })
        });
        expect(groupRes.status).toBe(200);
        const groupBody = await groupRes.json();
        const groupId = groupBody.groupId;
        expect(groupId).toBeTruthy();

        const participantRes = await fetch(`${baseUrl}/api/groups/${groupId}/participants`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrf,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                displayName: 'Bruno',
                type: 'adult',
                familyId: null
            })
        });
        expect(participantRes.status).toBe(200);
        const participantBody = await participantRes.json();
        const participantId = participantBody.participantId;
        expect(participantId).toBeTruthy();

        const ticketRes = await fetch(`${baseUrl}/api/groups/${groupId}/tickets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrf,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                type: 'Magic Ticket',
                eventAt: '2026-03-01T09:00:00Z',
                location: 'Orlando',
                status: 'planned',
                amount: 120,
                currency: 'USD',
                notes: 'Test ticket',
                participantIds: [participantId],
                expense: {
                    description: 'Ticket: Magic Ticket',
                    amount: 120,
                    currency: 'USD',
                    date: '2026-03-01T09:00:00Z',
                    category: 'Ticket',
                    payerParticipantId: participantId,
                    splitType: 'participants',
                    splitMode: 'equal',
                    participantIds: [participantId]
                }
            })
        });
        expect(ticketRes.status).toBe(200);
        const ticketBody = await ticketRes.json();
        expect(ticketBody.ok).toBe(true);
        expect(ticketBody.expenseId).toBeTruthy();

        const expensesRes = await fetch(`${baseUrl}/api/groups/${groupId}/expenses`, {
            headers: { Cookie: jarToHeader(jar) }
        });
        expect(expensesRes.status).toBe(200);
        const expensesBody = await expensesRes.json();
        expect(expensesBody.data).toHaveLength(1);
        expect(expensesBody.data[0]).toMatchObject({
            description: 'Ticket: Magic Ticket',
            amount: 120,
            currency: 'USD',
            payerParticipantId: participantId
        });
        expect(expensesBody.data[0].splits).toHaveLength(1);
        expect(expensesBody.data[0].splits[0].amount).toBe(120);
    });
});
