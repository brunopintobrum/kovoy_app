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
process.env.DB_PATH = path.join(os.tmpdir(), `orlando-test-invitations-${Date.now()}.db`);

const crypto = require('crypto');
const { startServer, db } = require('../server');

const hashValue = (value) => crypto.createHash('sha256').update(value).digest('hex');

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
            firstName: 'Invite',
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
        body: JSON.stringify({ name: 'Invite Group', defaultCurrency: 'USD' })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    return body.groupId;
};

const createInvite = async (baseUrl, jar, groupId, email, role = 'member') => {
    const res = await fetch(`${baseUrl}/api/groups/${groupId}/invitations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': jar.csrf_token,
            Cookie: jarToHeader(jar)
        },
        body: JSON.stringify({ email, role })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    return body.token;
};

describe('invitation flow', () => {
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

    test('invitation expires and cannot be accepted', async () => {
        const password = 'StrongPass!123';
        const ownerEmail = `owner.${Date.now()}@example.com`;
        const inviteeEmail = `invitee.${Date.now()}@example.com`;

        await registerUser(baseUrl, ownerEmail, password);
        const ownerJar = await loginUser(baseUrl, ownerEmail, password);
        await ensureCsrf(baseUrl, ownerJar);
        const groupId = await createGroup(baseUrl, ownerJar);
        const token = await createInvite(baseUrl, ownerJar, groupId, inviteeEmail);

        db.prepare('UPDATE invitations SET expires_at = ? WHERE token = ?').run(Date.now() - 1000, token);

        await registerUser(baseUrl, inviteeEmail, password);
        const inviteeJar = await loginUser(baseUrl, inviteeEmail, password);
        await ensureCsrf(baseUrl, inviteeJar);

        const res = await fetch(`${baseUrl}/api/invitations/accept`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': inviteeJar.csrf_token,
                Cookie: jarToHeader(inviteeJar)
            },
            body: JSON.stringify({ token })
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Invitation has expired.');

        const record = db.prepare('SELECT status FROM invitations WHERE token_hash = ?').get(hashValue(token));
        expect(record.status).toBe('expired');
    });

    test('invitation cannot be reused after acceptance', async () => {
        const password = 'StrongPass!123';
        const ownerEmail = `owner2.${Date.now()}@example.com`;
        const inviteeEmail = `invitee2.${Date.now()}@example.com`;

        await registerUser(baseUrl, ownerEmail, password);
        const ownerJar = await loginUser(baseUrl, ownerEmail, password);
        await ensureCsrf(baseUrl, ownerJar);
        const groupId = await createGroup(baseUrl, ownerJar);
        const token = await createInvite(baseUrl, ownerJar, groupId, inviteeEmail);

        await registerUser(baseUrl, inviteeEmail, password);
        const inviteeJar = await loginUser(baseUrl, inviteeEmail, password);
        await ensureCsrf(baseUrl, inviteeJar);

        const firstAccept = await fetch(`${baseUrl}/api/invitations/accept`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': inviteeJar.csrf_token,
                Cookie: jarToHeader(inviteeJar)
            },
            body: JSON.stringify({ token })
        });
        expect(firstAccept.status).toBe(200);

        const secondAccept = await fetch(`${baseUrl}/api/invitations/accept`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': inviteeJar.csrf_token,
                Cookie: jarToHeader(inviteeJar)
            },
            body: JSON.stringify({ token })
        });
        expect(secondAccept.status).toBe(400);
        const body = await secondAccept.json();
        expect(body.error).toBe('Invitation is no longer available.');
    });
});
