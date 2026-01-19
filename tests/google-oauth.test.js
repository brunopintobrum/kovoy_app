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
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.DB_PATH = path.join(os.tmpdir(), `orlando-test-google-${Date.now()}.db`);

jest.mock('https', () => ({
    request: (url, options, cb) => {
        const { EventEmitter } = require('events');
        let callback = cb;
        if (typeof options === 'function') {
            callback = options;
        }
        const req = new EventEmitter();
        req.write = () => {};
        req.end = () => {
            const res = new EventEmitter();
            res.statusCode = 200;
            const href = typeof url === 'string' ? url : url.href;
            let body = '{}';
            if (href.includes('oauth2.googleapis.com/tokeninfo')) {
                const info = global.mockTokenInfo || {};
                body = JSON.stringify(info);
            } else if (href.includes('oauth2.googleapis.com/token')) {
                const token = global.mockTokenResponse || { id_token: 'test-id-token' };
                body = JSON.stringify(token);
            }
            if (callback) callback(res);
            res.emit('data', body);
            res.emit('end');
        };
        return req;
    }
}));

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

describe('Google OAuth flow', () => {
    let server;
    let baseUrl;

    beforeAll(() => {
        server = startServer(0);
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
    });

    beforeEach(() => {
        global.mockTokenResponse = { id_token: 'test-id-token' };
        global.mockTokenInfo = {
            email: 'google.user@example.com',
            email_verified: true,
            sub: 'google-sub-123',
            aud: process.env.GOOGLE_CLIENT_ID,
            iss: 'https://accounts.google.com',
            name: 'Google User',
            given_name: 'Google',
            family_name: 'User',
            picture: 'https://lh3.googleusercontent.com/avatar.jpg'
        };
        db.prepare('DELETE FROM users').run();
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

    test('creates user with display name from Google profile', async () => {
        const initRes = await fetch(`${baseUrl}/api/auth/google`, { redirect: 'manual' });
        const setCookie = getSetCookies(initRes).join('; ');
        const match = setCookie.match(/google_oauth_state=([^;]+)/);
        expect(match).toBeTruthy();
        const state = match[1];

        const callbackRes = await fetch(
            `${baseUrl}/api/auth/google/callback?code=test-code&state=${state}`,
            {
                redirect: 'manual',
                headers: { Cookie: `google_oauth_state=${state}` }
            }
        );

        expect(callbackRes.status).toBe(302);
        expect(callbackRes.headers.get('location')).toBe('/dashboard#dashboard');

        const user = db.prepare('SELECT * FROM users WHERE google_sub = ?').get('google-sub-123');
        expect(user).toBeTruthy();
        expect(user.email).toBe('google.user@example.com');
        expect(user.first_name).toBe('Google');
        expect(user.last_name).toBe('User');
        expect(user.display_name).toBe('Google User');
        expect(user.avatar_url).toBe('https://lh3.googleusercontent.com/avatar.jpg');
        expect(user.email_verified_at).toBeTruthy();
    });

    test('falls back to email prefix when Google name is missing', async () => {
        global.mockTokenInfo = {
            email: 'go@example.com',
            email_verified: true,
            sub: 'google-sub-456',
            aud: process.env.GOOGLE_CLIENT_ID,
            iss: 'https://accounts.google.com'
        };

        const initRes = await fetch(`${baseUrl}/api/auth/google`, { redirect: 'manual' });
        const setCookie = getSetCookies(initRes).join('; ');
        const match = setCookie.match(/google_oauth_state=([^;]+)/);
        const state = match && match[1];

        const callbackRes = await fetch(
            `${baseUrl}/api/auth/google/callback?code=test-code&state=${state}`,
            {
                redirect: 'manual',
                headers: { Cookie: `google_oauth_state=${state}` }
            }
        );

        expect(callbackRes.status).toBe(302);
        const user = db.prepare('SELECT * FROM users WHERE google_sub = ?').get('google-sub-456');
        expect(user).toBeTruthy();
        expect(user.first_name).toBe('go');
        expect(user.last_name).toBe('go');
        expect(user.display_name).toBe('go');
    });

    test('rejects Google login when email is already linked to another Google account', async () => {
        db.prepare(
            'INSERT INTO users (email, password_hash, google_sub, first_name, last_name, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(
            'conflict@example.com',
            'hash',
            'google-sub-existing',
            'Existing',
            'User',
            'Existing User',
            new Date().toISOString()
        );

        global.mockTokenInfo = {
            email: 'conflict@example.com',
            email_verified: true,
            sub: 'google-sub-new',
            aud: process.env.GOOGLE_CLIENT_ID,
            iss: 'https://accounts.google.com',
            name: 'New User'
        };

        const initRes = await fetch(`${baseUrl}/api/auth/google`, { redirect: 'manual' });
        const setCookie = getSetCookies(initRes).join('; ');
        const match = setCookie.match(/google_oauth_state=([^;]+)/);
        const state = match && match[1];

        const callbackRes = await fetch(
            `${baseUrl}/api/auth/google/callback?code=test-code&state=${state}`,
            {
                redirect: 'manual',
                headers: { Cookie: `google_oauth_state=${state}` }
            }
        );

        expect(callbackRes.status).toBe(302);
        expect(callbackRes.headers.get('location')).toBe('/login?google=conflict');
    });

    test('uses email prefix when Google name is too short', async () => {
        global.mockTokenInfo = {
            email: 'short@example.com',
            email_verified: true,
            sub: 'google-sub-short',
            aud: process.env.GOOGLE_CLIENT_ID,
            iss: 'https://accounts.google.com',
            name: 'A'
        };

        const initRes = await fetch(`${baseUrl}/api/auth/google`, { redirect: 'manual' });
        const setCookie = getSetCookies(initRes).join('; ');
        const match = setCookie.match(/google_oauth_state=([^;]+)/);
        const state = match && match[1];

        const callbackRes = await fetch(
            `${baseUrl}/api/auth/google/callback?code=test-code&state=${state}`,
            {
                redirect: 'manual',
                headers: { Cookie: `google_oauth_state=${state}` }
            }
        );

        expect(callbackRes.status).toBe(302);
        const user = db.prepare('SELECT * FROM users WHERE google_sub = ?').get('google-sub-short');
        expect(user).toBeTruthy();
        expect(user.first_name).toBe('short');
        expect(user.last_name).toBe('short');
        expect(user.display_name).toBe('short');
    });
});
