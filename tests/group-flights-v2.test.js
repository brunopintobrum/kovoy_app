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
process.env.DB_PATH = path.join(os.tmpdir(), `orlando-test-flights-v2-${Date.now()}.db`);

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
    const email = `flight${Date.now()}@example.com`;
    const password = 'StrongPass!123';
    const jar = {};

    const registerRes = await fetch(`${baseUrl}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            firstName: 'Flight',
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

describe('group flights V2', () => {
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

    test('creates and updates flight with participants', async () => {
        const jar = await registerAndLogin(baseUrl);
        const csrf = jar.csrf_token;

        const groupRes = await fetch(`${baseUrl}/api/groups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrf,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({ name: 'Flight Group', defaultCurrency: 'USD' })
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

        const participantResTwo = await fetch(`${baseUrl}/api/groups/${groupId}/participants`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrf,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                displayName: 'Leticia',
                type: 'adult',
                familyId: null
            })
        });
        expect(participantResTwo.status).toBe(200);
        const participantTwoBody = await participantResTwo.json();
        const participantIdTwo = participantTwoBody.participantId;
        expect(participantIdTwo).toBeTruthy();

        const flightRes = await fetch(`${baseUrl}/api/groups/${groupId}/flights`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrf,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                airline: 'Delta',
                flightNumber: 'DL123',
                pnr: 'ABC123',
                cabinClass: 'economy',
                seat: '12A',
                baggage: '1 checked',
                status: 'planned',
                cost: 500,
                currency: 'USD',
                from: 'JFK',
                to: 'MCO',
                departAt: '2026-02-22T10:00:00Z',
                arriveAt: '2026-02-22T14:30:00Z',
                notes: 'Test flight',
                participantIds: [participantId]
            })
        });
        expect(flightRes.status).toBe(200);
        const flightBody = await flightRes.json();
        expect(flightBody.ok).toBe(true);
        expect(flightBody.id).toBeTruthy();

        const listRes = await fetch(`${baseUrl}/api/groups/${groupId}/flights`, {
            headers: { Cookie: jarToHeader(jar) }
        });
        expect(listRes.status).toBe(200);
        const listBody = await listRes.json();
        const created = listBody.data.find((item) => item.id === flightBody.id);
        expect(created).toBeTruthy();
        expect(created.participantIds).toEqual([participantId]);

        const updateRes = await fetch(`${baseUrl}/api/groups/${groupId}/flights/${flightBody.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrf,
                Cookie: jarToHeader(jar)
            },
            body: JSON.stringify({
                airline: 'Delta',
                flightNumber: 'DL123',
                pnr: 'ABC123',
                cabinClass: 'business',
                seat: '2A',
                baggage: '2 checked',
                status: 'paid',
                cost: 600,
                currency: 'USD',
                from: 'JFK',
                to: 'MCO',
                departAt: '2026-02-22T10:00:00Z',
                arriveAt: '2026-02-22T14:30:00Z',
                notes: 'Updated flight',
                participantIds: [participantIdTwo]
            })
        });
        expect(updateRes.status).toBe(200);

        const updatedRes = await fetch(`${baseUrl}/api/groups/${groupId}/flights`, {
            headers: { Cookie: jarToHeader(jar) }
        });
        expect(updatedRes.status).toBe(200);
        const updatedBody = await updatedRes.json();
        const updated = updatedBody.data.find((item) => item.id === flightBody.id);
        expect(updated).toBeTruthy();
        expect(updated.status).toBe('paid');
        expect(updated.participantIds).toEqual([participantIdTwo]);
    });
});
