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
process.env.DB_PATH = path.join(os.tmpdir(), `orlando-test-sanitize-${Date.now()}.db`);

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

describe('String sanitization', () => {
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

    test('sanitize group name by trimming whitespace', async () => {
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
                name: '   Test Group   ',
                defaultCurrency: 'USD'
            })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const groupId = body.groupId;

        // Verify the name was trimmed
        const groupRes = await fetch(`${baseUrl}/api/groups`, {
            headers: { Cookie: jarToHeader(jar) }
        });
        const groupsData = await groupRes.json();
        const group = groupsData.data.find((g) => g.id === groupId);
        expect(group.name).toBe('Test Group');
    });

    test('sanitize family name by removing control characters', async () => {
        const password = 'StrongPass!123';
        const email = `test-fam-${Date.now()}@example.com`;

        await registerUser(baseUrl, email, password);
        const jar = await loginUser(baseUrl, email, password);
        await ensureCsrf(baseUrl, jar);
        const groupId = await createGroup(baseUrl, jar);

        // Try to create family with control characters (null byte, etc)
        const res = await fetch(`${baseUrl}/api/groups/${groupId}/families`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': jar.csrf_token,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                name: 'Test\x00Family\x01Clean'
            })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const familyId = body.familyId;

        // Verify the name was sanitized (control chars removed)
        const familiesRes = await fetch(`${baseUrl}/api/groups/${groupId}/families`, {
            headers: { Cookie: jarToHeader(jar) }
        });
        const families = await familiesRes.json();
        const family = families.data.find((f) => f.id === familyId);
        expect(family.name).toBe('TestFamilyClean');
    });

    test('sanitize participant display name', async () => {
        const password = 'StrongPass!123';
        const email = `test-part-${Date.now()}@example.com`;

        await registerUser(baseUrl, email, password);
        const jar = await loginUser(baseUrl, email, password);
        await ensureCsrf(baseUrl, jar);
        const groupId = await createGroup(baseUrl, jar);

        // Create participant with leading/trailing spaces and control chars
        const res = await fetch(`${baseUrl}/api/groups/${groupId}/participants`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': jar.csrf_token,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                displayName: '  \x02Test Participant\x03  ',
                type: 'adult'
            })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const participantId = body.participantId;

        // Verify sanitization (trimmed and control chars removed)
        const participantsRes = await fetch(`${baseUrl}/api/groups/${groupId}/participants`, {
            headers: { Cookie: jarToHeader(jar) }
        });
        const participantsData = await participantsRes.json();
        const participantsList = participantsData.data || participantsData;
        const participant = Array.isArray(participantsList)
            ? participantsList.find((p) => p.id === participantId || p.participantId === participantId)
            : null;
        expect(participant?.displayName).toBe('Test Participant');
    });

    test('sanitize expense description', async () => {
        const password = 'StrongPass!123';
        const email = `test-exp-${Date.now()}@example.com`;

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
                description: '  Lunch\x00with\x01friends  ',
                amount: 50,
                currency: 'USD',
                date: new Date().toISOString(),
                payerParticipantId: participantId,
                splitType: 'participants',
                splitMode: 'equal',
                participantIds: [participantId]
            })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);

        // Verify sanitization in database
        const expense = db.prepare('SELECT description FROM expenses WHERE id = ?').get(body.expenseId);
        expect(expense.description).toBe('Lunchwithfriends');
    });

    test('preserve valid characters while removing control chars', async () => {
        const password = 'StrongPass!123';
        const email = `test-preserve-${Date.now()}@example.com`;

        await registerUser(baseUrl, email, password);
        const jar = await loginUser(baseUrl, email, password);
        await ensureCsrf(baseUrl, jar);
        const groupId = await createGroup(baseUrl, jar);

        // Create family with valid special characters and control chars mixed
        const res = await fetch(`${baseUrl}/api/groups/${groupId}/families`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': jar.csrf_token,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                name: 'Smith\'s Family (2024)\x00\x01'
            })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const familyId = body.familyId;

        const familiesRes = await fetch(`${baseUrl}/api/groups/${groupId}/families`, {
            headers: { Cookie: jarToHeader(jar) }
        });
        const families = await familiesRes.json();
        const family = families.data.find((f) => f.id === familyId);
        // Valid chars preserved, control chars removed
        expect(family.name).toBe('Smith\'s Family (2024)');
    });

});
