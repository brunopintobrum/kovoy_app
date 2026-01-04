const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const Database = require('better-sqlite3');

const ROOT_DIR = __dirname;
const ENV_PATH = path.join(ROOT_DIR, '.env');
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const COOKIE_NAME = 'auth_token';
const GOOGLE_STATE_COOKIE = 'google_oauth_state';
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKENINFO_ENDPOINT = 'https://oauth2.googleapis.com/tokeninfo';

const loadEnvFile = () => {
    if (!fs.existsSync(ENV_PATH)) return;
    const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) continue;
        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
};

loadEnvFile();

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        google_sub TEXT,
        created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all();
const hasGoogleSub = userColumns.some((column) => column.name === 'google_sub');
if (!hasGoogleSub) {
    db.exec('ALTER TABLE users ADD COLUMN google_sub TEXT');
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL');

const countUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (countUsers.count === 0) {
    const seedEmail = process.env.SEED_EMAIL || 'admin@orlando.local';
    const seedPassword = process.env.SEED_PASSWORD || 'orlando2026';
    const passwordHash = bcrypt.hashSync(seedPassword, 10);
    db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)').run(
        seedEmail,
        passwordHash,
        new Date().toISOString()
    );
    console.warn('Seed user created. Update SEED_EMAIL/SEED_PASSWORD and JWT_SECRET in production.');
}

app.use(express.json());
app.use(cookieParser());
app.use(express.static(ROOT_DIR));

const signToken = (user) => {
    return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
};

const getGoogleConfig = (req) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
    return { clientId, clientSecret, redirectUri };
};

const httpsRequest = (url, { method = 'GET', headers = {}, body } = {}) => {
    return new Promise((resolve, reject) => {
        const requestUrl = new URL(url);
        const req = https.request(requestUrl, { method, headers }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ status: res.statusCode || 500, body: data }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
};

const requestJson = async (url, options) => {
    const { status, body } = await httpsRequest(url, options);
    let data = {};
    if (body) {
        try {
            data = JSON.parse(body);
        } catch (err) {
            data = {};
        }
    }
    return { status, data };
};

const authRequired = (req, res, next) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.redirect('/login');
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        return next();
    } catch (err) {
        res.clearCookie(COOKIE_NAME);
        return res.redirect('/login');
    }
};

app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.sendFile(path.join(ROOT_DIR, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(ROOT_DIR, 'register.html')));
app.get('/forgot', (req, res) => res.sendFile(path.join(ROOT_DIR, 'forgot.html')));
app.get('/reset', (req, res) => res.sendFile(path.join(ROOT_DIR, 'reset.html')));
app.get('/orlando.html', authRequired, (req, res) => res.sendFile(path.join(ROOT_DIR, 'orlando.html')));

app.get('/api/auth/google', (req, res) => {
    const { clientId, clientSecret, redirectUri } = getGoogleConfig(req);
    if (!clientId || !clientSecret) {
        return res.redirect('/login?google=missing');
    }

    const state = crypto.randomBytes(16).toString('hex');
    res.cookie(GOOGLE_STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000
    });

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account'
    });

    return res.redirect(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
});

app.get('/api/auth/google/callback', async (req, res) => {
    const { clientId, clientSecret, redirectUri } = getGoogleConfig(req);
    if (!clientId || !clientSecret) {
        return res.redirect('/login?google=missing');
    }

    const { code, state } = req.query || {};
    const expectedState = req.cookies[GOOGLE_STATE_COOKIE];
    res.clearCookie(GOOGLE_STATE_COOKIE);

    if (!code || !state || !expectedState || state !== expectedState) {
        return res.redirect('/login?google=error');
    }

    try {
        const tokenBody = new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        }).toString();

        const tokenResponse = await requestJson(GOOGLE_TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenBody
        });

        const idToken = tokenResponse.data && tokenResponse.data.id_token;
        if (!idToken) {
            return res.redirect('/login?google=error');
        }

        const tokenInfoResponse = await requestJson(
            `${GOOGLE_TOKENINFO_ENDPOINT}?id_token=${encodeURIComponent(idToken)}`
        );

        const email = tokenInfoResponse.data && tokenInfoResponse.data.email;
        const emailVerified = tokenInfoResponse.data && tokenInfoResponse.data.email_verified;
        const googleSub = tokenInfoResponse.data && tokenInfoResponse.data.sub;
        if (!email || !googleSub || (emailVerified !== true && emailVerified !== 'true')) {
            return res.redirect('/login?google=error');
        }

        let user = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(googleSub);
        const userByEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (user) {
            if (userByEmail && userByEmail.id !== user.id) {
                return res.redirect('/login?google=conflict');
            }
            if (user.email !== email) {
                db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, user.id);
                user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
            }
        } else if (userByEmail) {
            if (userByEmail.google_sub) {
                return res.redirect('/login?google=conflict');
            }
            db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').run(googleSub, userByEmail.id);
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(userByEmail.id);
        } else {
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const passwordHash = bcrypt.hashSync(randomPassword, 10);
            const insert = db.prepare(
                'INSERT INTO users (email, password_hash, google_sub, created_at) VALUES (?, ?, ?, ?)'
            );
            insert.run(email, passwordHash, googleSub, new Date().toISOString());
            user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        }

        const token = signToken(user);
        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.redirect('/orlando.html');
    } catch (err) {
        console.error('Google auth error:', err);
        return res.redirect('/login?google=error');
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
    return res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    return res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Não autenticado.' });
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        return res.json({ email: payload.email });
    } catch (err) {
        return res.status(401).json({ error: 'Não autenticado.' });
    }
});

app.post('/api/register', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Senha precisa ter ao menos 8 caracteres.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
        return res.status(409).json({ error: 'Email já cadastrado.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)').run(
        email,
        passwordHash,
        new Date().toISOString()
    );
    return res.status(201).json({ ok: true });
});

app.post('/api/forgot', (req, res) => {
    const { email } = req.body || {};
    if (!email) {
        return res.status(400).json({ error: 'Email é obrigatório.' });
    }

    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!user) {
        return res.json({ ok: true });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000;

    db.prepare('INSERT INTO reset_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
        user.id,
        tokenHash,
        expiresAt,
        new Date().toISOString()
    );

    return res.json({ ok: true, token: rawToken });
});

app.post('/api/reset', (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password) {
        return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Senha precisa ter ao menos 8 caracteres.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = db.prepare('SELECT * FROM reset_tokens WHERE token_hash = ?').get(tokenHash);
    if (!record || record.expires_at < Date.now()) {
        return res.status(400).json({ error: 'Token inválido ou expirado.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, record.user_id);
    db.prepare('DELETE FROM reset_tokens WHERE id = ?').run(record.id);

    return res.json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`Servidor ativo em http://localhost:${PORT}`);
});
