const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const Database = require('better-sqlite3');

const ROOT_DIR = __dirname;
const ENV_PATH = path.join(ROOT_DIR, '.env');
const COOKIE_NAME = 'auth_token';
const REFRESH_COOKIE = 'refresh_token';
const GOOGLE_STATE_COOKIE = 'google_oauth_state';
const TWO_FACTOR_COOKIE = 'two_factor_token';
const CSRF_COOKIE = 'csrf_token';
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

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'app.db');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const IS_PROD = process.env.NODE_ENV === 'production';
const EMAIL_VERIFICATION_REQUIRED = process.env.EMAIL_VERIFICATION_REQUIRED !== 'false';
const TWO_FACTOR_REQUIRED = process.env.TWO_FACTOR_REQUIRED === 'true';
const EMAIL_TOKEN_TTL_MINUTES = Number(process.env.EMAIL_TOKEN_TTL_MINUTES || 60);
const TWO_FACTOR_TTL_MINUTES = Number(process.env.TWO_FACTOR_TTL_MINUTES || 10);
const TWO_FACTOR_ATTEMPT_LIMIT = Number(process.env.TWO_FACTOR_ATTEMPT_LIMIT || 5);
const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES || 30);
const ACCESS_TOKEN_TTL_MINUTES = Number(process.env.ACCESS_TOKEN_TTL_MINUTES || 30);
const REFRESH_TOKEN_TTL_DAYS_REMEMBER = Number(process.env.REFRESH_TOKEN_TTL_DAYS_REMEMBER || 30);
const REFRESH_TOKEN_TTL_DAYS_SESSION = Number(process.env.REFRESH_TOKEN_TTL_DAYS_SESSION || 1);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@example.com';
const APP_BASE_URL = process.env.APP_BASE_URL;

if (JWT_SECRET === 'change-this-secret') {
    if (IS_PROD) {
        throw new Error('JWT_SECRET must be set in production.');
    }
    console.warn('JWT_SECRET not set; using default for local development only.');
}

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
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
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS two_factor_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        consumed_at INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        remember INTEGER NOT NULL DEFAULT 0,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER,
        replaced_by TEXT,
        created_at TEXT NOT NULL,
        last_used_at INTEGER,
        user_agent TEXT,
        ip_addr TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all();
const hasGoogleSub = userColumns.some((column) => column.name === 'google_sub');
const hasEmailVerifiedAt = userColumns.some((column) => column.name === 'email_verified_at');
const hasTwoFactorEnabled = userColumns.some((column) => column.name === 'two_factor_enabled');
if (!hasGoogleSub) {
    db.exec('ALTER TABLE users ADD COLUMN google_sub TEXT');
}
if (!hasEmailVerifiedAt) {
    db.exec('ALTER TABLE users ADD COLUMN email_verified_at TEXT');
}
if (!hasTwoFactorEnabled) {
    db.exec('ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0');
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL');
db.exec('CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_two_factor_codes_user ON two_factor_codes(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash ON reset_tokens(token_hash)');
db.exec('CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_hash ON email_verification_tokens(token_hash)');
db.exec('CREATE INDEX IF NOT EXISTS idx_two_factor_codes_hash ON two_factor_codes(code_hash)');
db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)');
const refreshTokenColumns = db.prepare('PRAGMA table_info(refresh_tokens)').all();
const hasRememberColumn = refreshTokenColumns.some((column) => column.name === 'remember');
if (!hasRememberColumn) {
    db.exec('ALTER TABLE refresh_tokens ADD COLUMN remember INTEGER NOT NULL DEFAULT 0');
}

const countUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (countUsers.count === 0) {
    const seedEmail = process.env.SEED_EMAIL;
    const seedPassword = process.env.SEED_PASSWORD;
    if (seedEmail && seedPassword) {
        const passwordHash = bcrypt.hashSync(seedPassword, 10);
        db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)').run(
            seedEmail,
            passwordHash,
            new Date().toISOString()
        );
        console.warn('Seed user created from SEED_EMAIL/SEED_PASSWORD.');
    }
}

app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            'default-src': ["'self'"],
            'base-uri': ["'self'"],
            'frame-ancestors': ["'none'"],
            'img-src': ["'self'", 'data:'],
            'script-src': ["'self'"],
            'style-src': ["'self'", 'https://fonts.googleapis.com'],
            'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:']
        }
    }
}));
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(express.static(PUBLIC_DIR));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false
});

const sensitiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false
});

const signAccessToken = (user) => {
    return jwt.sign(
        { sub: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: `${ACCESS_TOKEN_TTL_MINUTES}m` }
    );
};

const isAllowedOrigin = (origin, host) => {
    if (!origin) return true;
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    const selfOrigin = `${IS_PROD ? 'https' : 'http'}://${host}`;
    return origin === selfOrigin;
};

const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const normalized = email.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
};

const validatePassword = (email, password) => {
    const errors = [];
    if (typeof password !== 'string') {
        return ['Invalid password.'];
    }
    if (password.length < 8 || password.length > 64) {
        errors.push('Password must be between 8 and 64 characters.');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must include 1 uppercase letter.');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must include 1 lowercase letter.');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must include 1 number.');
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':",.<>/?\\|]/.test(password)) {
        errors.push('Password must include 1 special character.');
    }
    if (password.trim() !== password) {
        errors.push('Password cannot start or end with spaces.');
    }
    const commonPasswords = [
        '123456', '12345678', 'password', 'qwerty', 'abc123',
        '111111', '123123', 'qwerty123', 'admin', 'letmein'
    ];
    const lowered = password.toLowerCase();
    if (commonPasswords.some((item) => lowered.includes(item))) {
        errors.push('Password is too common.');
    }
    if (email && typeof email === 'string') {
        const normalizedEmail = email.trim().toLowerCase();
        if (normalizedEmail && lowered === normalizedEmail) {
            errors.push('Password cannot match the email.');
        }
    }
    return errors;
};

const originGuard = (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const origin = req.get('origin');
        const host = req.get('host');
        if (!isAllowedOrigin(origin, host)) {
            return res.status(403).json({ error: 'Origem nao autorizada.' });
        }
    }
    return next();
};

const getGoogleConfig = (req) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
        process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
    if (IS_PROD && !process.env.GOOGLE_REDIRECT_URI) {
        throw new Error('GOOGLE_REDIRECT_URI must be set in production.');
    }
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

const hashValue = (value) => {
    return crypto.createHash('sha256').update(value).digest('hex');
};

const getBaseUrl = (req) => {
    if (APP_BASE_URL) return APP_BASE_URL.replace(/\/+$/, '');
    return `${req.protocol}://${req.get('host')}`;
};

const isEmailConfigured = () => {
    return Boolean(SMTP_HOST);
};

const getEmailTransporter = () => {
    if (!SMTP_HOST) {
        console.warn('SMTP not configured. Skipping email send.');
        return null;
    }

    let nodemailer;
    try {
        nodemailer = require('nodemailer');
    } catch (err) {
        console.error('nodemailer is not installed. Run npm install to enable email sending.');
        return null;
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
    });
};

const sendResetEmail = async ({ to, resetUrl }) => {
    const transporter = getEmailTransporter();
    if (!transporter) return false;

    await transporter.sendMail({
        from: SMTP_FROM,
        to,
        subject: 'Reset your password',
        text: `Use the link below to reset your password:\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
        html: `
            <p>Use the link below to reset your password:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>If you did not request this, ignore this email.</p>
        `
    });

    return true;
};

const sendVerificationEmail = async ({ to, verifyUrl }) => {
    const transporter = getEmailTransporter();
    if (!transporter) return false;

    await transporter.sendMail({
        from: SMTP_FROM,
        to,
        subject: 'Verify your email',
        text: `Use the link below to verify your email:\n\n${verifyUrl}\n\nIf you did not request this, ignore this email.`,
        html: `
            <p>Use the link below to verify your email:</p>
            <p><a href="${verifyUrl}">${verifyUrl}</a></p>
            <p>If you did not request this, ignore this email.</p>
        `
    });

    return true;
};

const sendTwoFactorEmail = async ({ to, code }) => {
    const transporter = getEmailTransporter();
    if (!transporter) return false;

    await transporter.sendMail({
        from: SMTP_FROM,
        to,
        subject: 'Your verification code',
        text: `Your verification code is: ${code}\n\nThis code expires in ${TWO_FACTOR_TTL_MINUTES} minutes.`,
        html: `
            <p>Your verification code is:</p>
            <p style="font-size: 20px; font-weight: bold;">${code}</p>
            <p>This code expires in ${TWO_FACTOR_TTL_MINUTES} minutes.</p>
        `
    });

    return true;
};

const ensureCsrfCookie = (req, res) => {
    if (!req.cookies[CSRF_COOKIE]) {
        const token = crypto.randomBytes(16).toString('hex');
        res.cookie(CSRF_COOKIE, token, {
            httpOnly: false,
            sameSite: 'lax',
            secure: IS_PROD,
            maxAge: 60 * 60 * 1000
        });
    }
};

const requireCsrfToken = (req, res, next) => {
    const header = req.get('x-csrf-token');
    const cookie = req.cookies[CSRF_COOKIE];
    if (!header || !cookie || header !== cookie) {
        return res.status(403).json({ error: 'CSRF validation failed.' });
    }
    return next();
};

const createEmailVerificationToken = (userId) => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashValue(rawToken);
    const expiresAt = Date.now() + EMAIL_TOKEN_TTL_MINUTES * 60 * 1000;
    db.prepare('DELETE FROM email_verification_tokens WHERE user_id = ? AND used_at IS NULL').run(userId);
    db.prepare(
        'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)'
    ).run(userId, tokenHash, expiresAt, new Date().toISOString());
    return rawToken;
};

const verifyEmailToken = (rawToken) => {
    const tokenHash = hashValue(rawToken);
    const record = db.prepare('SELECT * FROM email_verification_tokens WHERE token_hash = ?').get(tokenHash);
    if (!record) return { status: 'invalid' };
    if (record.used_at) return { status: 'used', record };
    if (record.expires_at < Date.now()) return { status: 'expired', record };
    return { status: 'valid', record };
};

const createTwoFactorCode = (userId) => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const codeHash = hashValue(code);
    const expiresAt = Date.now() + TWO_FACTOR_TTL_MINUTES * 60 * 1000;
    db.prepare('DELETE FROM two_factor_codes WHERE user_id = ? AND consumed_at IS NULL').run(userId);
    db.prepare(
        'INSERT INTO two_factor_codes (user_id, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)'
    ).run(userId, codeHash, expiresAt, new Date().toISOString());
    return code;
};

const getTwoFactorSession = (req) => {
    const token = req.cookies[TWO_FACTOR_COOKIE];
    if (!token) return null;
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (!payload || !payload.tfa) return null;
        return payload;
    } catch (err) {
        return null;
    }
};

const issueTwoFactorSession = (res, userId, remember) => {
    const token = jwt.sign(
        { sub: userId, tfa: true, remember: Boolean(remember) },
        JWT_SECRET,
        { expiresIn: `${TWO_FACTOR_TTL_MINUTES}m` }
    );
    res.cookie(TWO_FACTOR_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: IS_PROD,
        maxAge: TWO_FACTOR_TTL_MINUTES * 60 * 1000
    });
    return token;
};

const setAccessCookie = (res, token) => {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: IS_PROD,
        maxAge: ACCESS_TOKEN_TTL_MINUTES * 60 * 1000
    });
};

const createRefreshToken = (userId, remember, req) => {
    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = hashValue(rawToken);
    const ttlDays = remember ? REFRESH_TOKEN_TTL_DAYS_REMEMBER : REFRESH_TOKEN_TTL_DAYS_SESSION;
    const expiresAt = Date.now() + ttlDays * 24 * 60 * 60 * 1000;

    db.prepare(
        `INSERT INTO refresh_tokens
        (user_id, token_hash, remember, expires_at, created_at, user_agent, ip_addr)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
        userId,
        tokenHash,
        remember ? 1 : 0,
        expiresAt,
        new Date().toISOString(),
        req.get('user-agent') || null,
        req.ip || null
    );

    return { rawToken, expiresAt, ttlDays };
};

const setRefreshCookie = (res, rawToken, ttlDays) => {
    res.cookie(REFRESH_COOKIE, rawToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: IS_PROD,
        maxAge: ttlDays * 24 * 60 * 60 * 1000
    });
};

const revokeRefreshToken = (rawToken, replacedBy) => {
    if (!rawToken) return;
    const tokenHash = hashValue(rawToken);
    db.prepare(
        'UPDATE refresh_tokens SET revoked_at = ?, replaced_by = ? WHERE token_hash = ? AND revoked_at IS NULL'
    ).run(Date.now(), replacedBy || null, tokenHash);
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
app.get('/login', (req, res) => {
    ensureCsrfCookie(req, res);
    return res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});
app.get('/register', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'register.html')));
app.get('/forgot', (req, res) => {
    ensureCsrfCookie(req, res);
    return res.sendFile(path.join(PUBLIC_DIR, 'forgot.html'));
});
app.get('/reset', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'reset.html')));
app.get('/confirm-mail', (req, res) => {
    ensureCsrfCookie(req, res);
    const { token, status } = req.query || {};
    if (!token) {
        return res.sendFile(path.join(PUBLIC_DIR, 'confirm-mail.html'));
    }
    const result = verifyEmailToken(token);
    if (result.status === 'valid') {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.record.user_id);
        if (user && !user.email_verified_at) {
            db.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?').run(
                new Date().toISOString(),
                user.id
            );
        }
        db.prepare('UPDATE email_verification_tokens SET used_at = ? WHERE id = ?').run(Date.now(), result.record.id);
        return res.redirect('/confirm-mail?status=success');
    }
    const nextStatus = status || result.status;
    return res.redirect(`/confirm-mail?status=${encodeURIComponent(nextStatus)}`);
});

app.get('/email-verification', (req, res) => {
    ensureCsrfCookie(req, res);
    return res.sendFile(path.join(PUBLIC_DIR, 'email-verification.html'));
});

app.get('/two-step-verification', (req, res) => {
    ensureCsrfCookie(req, res);
    const session = getTwoFactorSession(req);
    if (!session) {
        return res.redirect('/login');
    }
    return res.sendFile(path.join(PUBLIC_DIR, 'two-step-verification.html'));
});
app.get('/orlando.html', authRequired, (req, res) => res.sendFile(path.join(ROOT_DIR, 'orlando.html')));

app.get('/api/auth/google', authLimiter, (req, res) => {
    const { clientId, clientSecret, redirectUri } = getGoogleConfig(req);
    if (!clientId || !clientSecret) {
        return res.redirect('/login?google=missing');
    }

    const state = crypto.randomBytes(16).toString('hex');
    res.cookie(GOOGLE_STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: 'lax',
        secure: IS_PROD,
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

app.get('/api/auth/google/callback', authLimiter, async (req, res) => {
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
    const tokenAud = tokenInfoResponse.data && tokenInfoResponse.data.aud;
    const tokenIss = tokenInfoResponse.data && tokenInfoResponse.data.iss;
    const issOk = tokenIss === 'https://accounts.google.com' || tokenIss === 'accounts.google.com';
    if (!email || !googleSub || (emailVerified !== true && emailVerified !== 'true')) {
        return res.redirect('/login?google=error');
    }
    if (tokenAud !== clientId || !issOk) {
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

        if (user && !user.email_verified_at) {
            db.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?').run(
                new Date().toISOString(),
                user.id
            );
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
        }

        const remember = true;
        if (TWO_FACTOR_REQUIRED || user.two_factor_enabled) {
            const code = createTwoFactorCode(user.id);
            try {
                const sent = await sendTwoFactorEmail({ to: user.email, code });
                if (!sent && !IS_PROD) {
                    console.warn(`Two-factor code for ${user.email}: ${code}`);
                }
            } catch (err) {
                console.error('Two-factor email error:', err);
                if (!IS_PROD) {
                    console.warn(`Two-factor code for ${user.email}: ${code}`);
                }
            }
            issueTwoFactorSession(res, user.id, remember);
            return res.redirect('/two-step-verification');
        }

        const accessToken = signAccessToken(user);
        setAccessCookie(res, accessToken);
        const refreshToken = createRefreshToken(user.id, remember, req);
        setRefreshCookie(res, refreshToken.rawToken, refreshToken.ttlDays);

        return res.redirect('/orlando.html');
    } catch (err) {
        console.error('Google auth error:', err);
        return res.redirect('/login?google=error');
    }
});

app.post('/api/login', sensitiveLimiter, originGuard, async (req, res) => {
    const { email, password } = req.body || {};
    const remember = Boolean(req.body && req.body.remember);
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email address.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (EMAIL_VERIFICATION_REQUIRED && !user.email_verified_at) {
        const rawToken = createEmailVerificationToken(user.id);
        const verifyUrl = `${getBaseUrl(req)}/confirm-mail?token=${encodeURIComponent(rawToken)}`;
        try {
            const sent = await sendVerificationEmail({ to: user.email, verifyUrl });
            if (!sent && !IS_PROD) {
                console.warn(`Email verification link for ${user.email}: ${verifyUrl}`);
            }
        } catch (err) {
            console.error('Email verification error:', err);
            if (!IS_PROD) {
                console.warn(`Email verification link for ${user.email}: ${verifyUrl}`);
            }
        }
        return res.status(403).json({
            error: 'Email verification required.',
            code: 'email_verification_required'
        });
    }

    if (TWO_FACTOR_REQUIRED || user.two_factor_enabled) {
        const code = createTwoFactorCode(user.id);
        try {
            const sent = await sendTwoFactorEmail({ to: user.email, code });
            if (!sent && !IS_PROD) {
                console.warn(`Two-factor code for ${user.email}: ${code}`);
            }
        } catch (err) {
            console.error('Two-factor email error:', err);
            if (!IS_PROD) {
                console.warn(`Two-factor code for ${user.email}: ${code}`);
            }
        }
        issueTwoFactorSession(res, user.id, remember);
        return res.status(202).json({ twoFactorRequired: true });
    }

    const accessToken = signAccessToken(user);
    setAccessCookie(res, accessToken);
    const refreshToken = createRefreshToken(user.id, remember, req);
    setRefreshCookie(res, refreshToken.rawToken, refreshToken.ttlDays);
    return res.json({ ok: true });
});

app.post('/api/logout', originGuard, (req, res) => {
    res.clearCookie(COOKIE_NAME);
    if (req.cookies[REFRESH_COOKIE]) {
        revokeRefreshToken(req.cookies[REFRESH_COOKIE]);
    }
    res.clearCookie(REFRESH_COOKIE);
    res.clearCookie(TWO_FACTOR_COOKIE);
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

app.post('/api/refresh', originGuard, requireCsrfToken, (req, res) => {
    const rawToken = req.cookies[REFRESH_COOKIE];
    if (!rawToken) {
        return res.status(401).json({ error: 'Refresh token required.' });
    }

    const tokenHash = hashValue(rawToken);
    const record = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash);
    if (!record || record.revoked_at || record.expires_at < Date.now()) {
        if (record && !record.revoked_at) {
            revokeRefreshToken(rawToken);
        }
        res.clearCookie(REFRESH_COOKIE);
        res.clearCookie(COOKIE_NAME);
        return res.status(401).json({ error: 'Invalid refresh token.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(record.user_id);
    if (!user) {
        revokeRefreshToken(rawToken);
        res.clearCookie(REFRESH_COOKIE);
        res.clearCookie(COOKIE_NAME);
        return res.status(401).json({ error: 'Invalid session.' });
    }

    const remember = Boolean(record.remember);
    const newRefresh = createRefreshToken(user.id, remember, req);
    revokeRefreshToken(rawToken, hashValue(newRefresh.rawToken));

    const accessToken = signAccessToken(user);
    setAccessCookie(res, accessToken);
    setRefreshCookie(res, newRefresh.rawToken, newRefresh.ttlDays);

    db.prepare('UPDATE refresh_tokens SET last_used_at = ? WHERE id = ?').run(Date.now(), record.id);
    return res.json({ ok: true });
});

app.post('/api/register', sensitiveLimiter, originGuard, async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email address.' });
    }
    const passwordErrors = validatePassword(email, password);
    if (passwordErrors.length) {
        return res.status(400).json({ error: passwordErrors[0] });
    }

    try {
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered.' });
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        const insert = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)').run(
            email,
            passwordHash,
            new Date().toISOString()
        );
        if (EMAIL_VERIFICATION_REQUIRED) {
            const rawToken = createEmailVerificationToken(insert.lastInsertRowid);
            const verifyUrl = `${getBaseUrl(req)}/confirm-mail?token=${encodeURIComponent(rawToken)}`;
            try {
                const sent = await sendVerificationEmail({ to: email, verifyUrl });
                if (!sent && !IS_PROD) {
                    console.warn(`Email verification link for ${email}: ${verifyUrl}`);
                }
            } catch (err) {
                console.error('Email verification error:', err);
                if (!IS_PROD) {
                    console.warn(`Email verification link for ${email}: ${verifyUrl}`);
                }
            }
        }
        return res.status(201).json({ ok: true, emailVerificationRequired: EMAIL_VERIFICATION_REQUIRED });
    } catch (err) {
        const message = err && err.message ? err.message : '';
        if (message.includes('database is locked') || message.includes('SQLITE_BUSY')) {
            return res.status(503).json({ error: 'Database is busy. Please try again.' });
        }
        console.error('Register error:', err);
        return res.status(500).json({ error: 'Unexpected server error.' });
    }
});

app.post('/api/forgot', sensitiveLimiter, originGuard, requireCsrfToken, async (req, res) => {
    const { email } = req.body || {};
    if (!email) {
        return res.status(400).json({ error: 'Email é obrigatório.' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email address.' });
    }

    if (!isEmailConfigured()) {
        return res.status(503).json({ error: 'Email service is not available right now.' });
    }

    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!user) {
        return res.json({ ok: true });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000;

    db.prepare('DELETE FROM reset_tokens WHERE user_id = ?').run(user.id);
    db.prepare('INSERT INTO reset_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
        user.id,
        tokenHash,
        expiresAt,
        new Date().toISOString()
    );

    const resetUrl = `${getBaseUrl(req)}/reset?token=${encodeURIComponent(rawToken)}`;
    try {
        const sent = await sendResetEmail({ to: email, resetUrl });
        if (!sent && !IS_PROD) {
            console.warn(`Password reset email could not be sent for ${email}.`);
        }
    } catch (err) {
        console.error('Reset email error:', err);
        if (!IS_PROD) {
            console.warn(`Password reset email could not be sent for ${email}.`);
        }
    }
    return res.json({ ok: true });
});

app.post('/api/email-verification/resend', sensitiveLimiter, originGuard, requireCsrfToken, async (req, res) => {
    const { email } = req.body || {};
    if (!isValidEmail(email)) {
        return res.json({ ok: true });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || user.email_verified_at) {
        return res.json({ ok: true });
    }

    const rawToken = createEmailVerificationToken(user.id);
    const verifyUrl = `${getBaseUrl(req)}/confirm-mail?token=${encodeURIComponent(rawToken)}`;
    try {
        const sent = await sendVerificationEmail({ to: user.email, verifyUrl });
        if (!sent && !IS_PROD) {
            console.warn(`Email verification link for ${user.email}: ${verifyUrl}`);
        }
    } catch (err) {
        console.error('Email verification error:', err);
        if (!IS_PROD) {
            console.warn(`Email verification link for ${user.email}: ${verifyUrl}`);
        }
    }
    return res.json({ ok: true });
});

app.post('/api/two-step/verify', sensitiveLimiter, originGuard, requireCsrfToken, (req, res) => {
    const session = getTwoFactorSession(req);
    if (!session) {
        return res.status(401).json({ error: 'Two-factor session required.' });
    }

    const { code } = req.body || {};
    const codeValue = typeof code === 'string' ? code.trim() : '';
    if (!/^\d{4}$/.test(codeValue)) {
        return res.status(400).json({ error: 'Invalid verification code.' });
    }

    const record = db.prepare(
        'SELECT * FROM two_factor_codes WHERE user_id = ? AND consumed_at IS NULL ORDER BY id DESC LIMIT 1'
    ).get(session.sub);
    if (!record || record.expires_at < Date.now()) {
        return res.status(400).json({ error: 'Invalid verification code.' });
    }

    if (record.attempts >= TWO_FACTOR_ATTEMPT_LIMIT) {
        db.prepare('DELETE FROM two_factor_codes WHERE id = ?').run(record.id);
        return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
    }

    const codeHash = hashValue(codeValue);
    if (codeHash !== record.code_hash) {
        db.prepare('UPDATE two_factor_codes SET attempts = attempts + 1 WHERE id = ?').run(record.id);
        return res.status(400).json({ error: 'Invalid verification code.' });
    }

    db.prepare('UPDATE two_factor_codes SET consumed_at = ? WHERE id = ?').run(Date.now(), record.id);
    res.clearCookie(TWO_FACTOR_COOKIE);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.sub);
    if (!user) {
        return res.status(401).json({ error: 'Invalid session.' });
    }

    const remember = Boolean(session.remember);
    const accessToken = signAccessToken(user);
    setAccessCookie(res, accessToken);
    const refreshToken = createRefreshToken(user.id, remember, req);
    setRefreshCookie(res, refreshToken.rawToken, refreshToken.ttlDays);
    return res.json({ ok: true });
});

app.post('/api/two-step/resend', sensitiveLimiter, originGuard, requireCsrfToken, async (req, res) => {
    const session = getTwoFactorSession(req);
    if (!session) {
        return res.status(401).json({ error: 'Two-factor session required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.sub);
    if (!user) {
        return res.status(401).json({ error: 'Invalid session.' });
    }

    const code = createTwoFactorCode(user.id);
    try {
        const sent = await sendTwoFactorEmail({ to: user.email, code });
        if (!sent && !IS_PROD) {
            console.warn(`Two-factor code for ${user.email}: ${code}`);
        }
    } catch (err) {
        console.error('Two-factor email error:', err);
        if (!IS_PROD) {
            console.warn(`Two-factor code for ${user.email}: ${code}`);
        }
    }
    return res.json({ ok: true });
});

app.post('/api/reset', sensitiveLimiter, originGuard, (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password) {
        return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
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

const startServer = (port = PORT, onReady) => {
    const server = app.listen(port, () => {
        if (typeof onReady === 'function') {
            onReady(server);
        } else if (port === PORT) {
            console.log(`Servidor ativo em http://localhost:${port}`);
        }
    });
    return server;
};

if (require.main === module) {
    startServer(PORT);
}

module.exports = {
    app,
    db,
    startServer,
    createEmailVerificationToken,
    createTwoFactorCode
};
