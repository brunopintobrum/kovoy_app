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
process.env.DB_PATH = path.join(os.tmpdir(), `orlando-test-pagination-${Date.now()}.db`);

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

describe('Pagination', () => {
    let server;
    let baseUrl;
    let jar;
    let groupId;

    beforeAll(async () => {
        server = startServer(0);
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;

        const email = `test-pagination-${Date.now()}@example.com`;
        const password = 'Password123!';
        await registerUser(baseUrl, email, password);
        jar = await loginUser(baseUrl, email, password);
        await ensureCsrf(baseUrl, jar);
        groupId = await createGroup(baseUrl, jar);
    });

    afterAll(() => {
        server.close();
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

    describe('Expenses pagination', () => {
        let participantId;

        beforeEach(async () => {
            // Create a participant for the expense payer
            const participantRes = await fetch(`${baseUrl}/api/groups/${groupId}/participants`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': jar.csrf_token,
                    Cookie: jarToHeader(jar)
                },
                body: JSON.stringify({
                    displayName: 'Test Payer',
                    type: 'adult'
                })
            });
            expect(participantRes.status).toBe(200);
            const participantBody = await participantRes.json();
            participantId = participantBody.participantId || participantBody.id;

            // Insert 5 test expenses directly into the database
            const insertExpense = db.prepare(`
                INSERT INTO expenses (group_id, description, amount, currency, date, category, payer_participant_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const now = new Date().toISOString();
            for (let i = 1; i <= 5; i++) {
                insertExpense.run(
                    groupId,
                    `Expense ${i}`,
                    100,
                    'USD',
                    `2024-01-${String(i).padStart(2, '0')}`,
                    'food',
                    participantId,
                    now
                );
            }
        });

        afterEach(() => {
            // Clean up expenses after each test
            db.prepare('DELETE FROM expense_splits WHERE expense_id IN (SELECT id FROM expenses WHERE group_id = ?)').run(groupId);
            db.prepare('DELETE FROM expenses WHERE group_id = ?').run(groupId);
        });

        it('should return first page with limit=2', async () => {
            const res = await fetch(`${baseUrl}/api/groups/${groupId}/expenses?page=1&limit=2`, {
                headers: { Cookie: jarToHeader(jar) }
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.ok).toBe(true);
            expect(body.data).toHaveLength(2);
            expect(body.total).toBe(5);
            expect(body.page).toBe(1);
            expect(body.limit).toBe(2);
            expect(body.pages).toBe(3);
        });

        it('should return last page with limit=2', async () => {
            const res = await fetch(`${baseUrl}/api/groups/${groupId}/expenses?page=3&limit=2`, {
                headers: { Cookie: jarToHeader(jar) }
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.ok).toBe(true);
            expect(body.data).toHaveLength(1);
            expect(body.total).toBe(5);
            expect(body.page).toBe(3);
            expect(body.limit).toBe(2);
            expect(body.pages).toBe(3);
        });

        it('should return all results with defaults (no pagination params)', async () => {
            const res = await fetch(`${baseUrl}/api/groups/${groupId}/expenses`, {
                headers: { Cookie: jarToHeader(jar) }
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.ok).toBe(true);
            expect(body.data).toHaveLength(5);
            expect(body.total).toBe(5);
            expect(body.page).toBe(1);
            expect(body.limit).toBe(20);
            expect(body.pages).toBe(1);
        });

        it('should handle invalid page number (return page=1)', async () => {
            const res = await fetch(`${baseUrl}/api/groups/${groupId}/expenses?page=-1&limit=2`, {
                headers: { Cookie: jarToHeader(jar) }
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.ok).toBe(true);
            expect(body.page).toBe(1);
            expect(body.data).toHaveLength(2);
        });

        it('should cap limit to 100', async () => {
            const res = await fetch(`${baseUrl}/api/groups/${groupId}/expenses?page=1&limit=200`, {
                headers: { Cookie: jarToHeader(jar) }
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.ok).toBe(true);
            expect(body.limit).toBe(100);
        });
    });
});
