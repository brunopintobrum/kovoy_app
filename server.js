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
const multer = require('multer');
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
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const AVATAR_UPLOAD_DIR = path.join(UPLOADS_DIR, 'avatars');
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
if (!fs.existsSync(AVATAR_UPLOAD_DIR)) {
    fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
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
        first_name TEXT,
        last_name TEXT,
        display_name TEXT,
        avatar_url TEXT,
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
    CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        name TEXT,
        start_date TEXT,
        end_date TEXT,
        base TEXT,
        family_one TEXT,
        family_two TEXT,
        subtitle TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS trip_flights (
        id TEXT PRIMARY KEY,
        trip_id INTEGER NOT NULL,
        airline TEXT,
        pnr TEXT,
        group_name TEXT,
        cost REAL,
        currency TEXT,
        from_city TEXT,
        to_city TEXT,
        depart_at TEXT,
        arrive_at TEXT,
        notes TEXT,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS trip_lodgings (
        id TEXT PRIMARY KEY,
        trip_id INTEGER NOT NULL,
        name TEXT,
        address TEXT,
        check_in TEXT,
        check_out TEXT,
        cost REAL,
        currency TEXT,
        host TEXT,
        contact TEXT,
        notes TEXT,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS trip_cars (
        id TEXT PRIMARY KEY,
        trip_id INTEGER NOT NULL,
        vehicle TEXT,
        provider TEXT,
        cost REAL,
        currency TEXT,
        pickup TEXT,
        dropoff TEXT,
        location TEXT,
        notes TEXT,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS trip_expenses (
        id TEXT PRIMARY KEY,
        trip_id INTEGER NOT NULL,
        category TEXT,
        amount REAL,
        currency TEXT,
        status TEXT,
        due_date TEXT,
        group_name TEXT,
        split TEXT,
        notes TEXT,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS trip_transports (
        id TEXT PRIMARY KEY,
        trip_id INTEGER NOT NULL,
        type TEXT,
        date TEXT,
        amount REAL,
        currency TEXT,
        group_name TEXT,
        notes TEXT,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS trip_timeline (
        id TEXT PRIMARY KEY,
        trip_id INTEGER NOT NULL,
        date TEXT,
        time TEXT,
        title TEXT,
        notes TEXT,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS trip_reminders (
        id TEXT PRIMARY KEY,
        trip_id INTEGER NOT NULL,
        date TEXT,
        title TEXT,
        description TEXT,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );
`);
db.exec('DROP TABLE IF EXISTS trip_data');

const userColumns = db.prepare('PRAGMA table_info(users)').all();
const hasGoogleSub = userColumns.some((column) => column.name === 'google_sub');
const hasEmailVerifiedAt = userColumns.some((column) => column.name === 'email_verified_at');
const hasTwoFactorEnabled = userColumns.some((column) => column.name === 'two_factor_enabled');
const hasDisplayName = userColumns.some((column) => column.name === 'display_name');
const hasFirstName = userColumns.some((column) => column.name === 'first_name');
const hasLastName = userColumns.some((column) => column.name === 'last_name');
const hasAvatarUrl = userColumns.some((column) => column.name === 'avatar_url');
if (!hasGoogleSub) {
    db.exec('ALTER TABLE users ADD COLUMN google_sub TEXT');
}
if (!hasEmailVerifiedAt) {
    db.exec('ALTER TABLE users ADD COLUMN email_verified_at TEXT');
}
if (!hasTwoFactorEnabled) {
    db.exec('ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0');
}
if (!hasDisplayName) {
    db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
}
if (!hasFirstName) {
    db.exec('ALTER TABLE users ADD COLUMN first_name TEXT');
}
if (!hasLastName) {
    db.exec('ALTER TABLE users ADD COLUMN last_name TEXT');
}
if (!hasAvatarUrl) {
    db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL');
db.exec('CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_two_factor_codes_user ON two_factor_codes(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash ON reset_tokens(token_hash)');
db.exec('CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_hash ON email_verification_tokens(token_hash)');
db.exec('CREATE INDEX IF NOT EXISTS idx_two_factor_codes_hash ON two_factor_codes(code_hash)');
db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_trip_flights_trip ON trip_flights(trip_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_trip_lodgings_trip ON trip_lodgings(trip_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_trip_cars_trip ON trip_cars(trip_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_trip_expenses_trip ON trip_expenses(trip_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_trip_transports_trip ON trip_transports(trip_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_trip_timeline_trip ON trip_timeline(trip_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_trip_reminders_trip ON trip_reminders(trip_id)');
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
            'img-src': ["'self'", 'data:', 'https://lh3.googleusercontent.com'],
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

const normalizeName = (value, fieldLabel) => {
    if (typeof value !== 'string') return { error: `${fieldLabel} is required.` };
    const trimmed = value.trim();
    if (!trimmed) return { error: `${fieldLabel} is required.` };
    if (trimmed.length > 80) {
        return { error: `${fieldLabel} must be 80 characters or fewer.` };
    }
    return { value: trimmed };
};

const normalizeOptionalName = (value) => {
    if (value === undefined || value === null) return { value: null };
    if (typeof value !== 'string') return { error: 'Invalid name.' };
    const trimmed = value.trim();
    if (!trimmed) return { value: null };
    if (trimmed.length < 2) return { value: null };
    if (trimmed.length > 80) {
        return { error: 'Name must be 80 characters or fewer.' };
    }
    return { value: trimmed };
};

const normalizeOptionalUrl = (value) => {
    if (value === undefined || value === null) return { value: null };
    if (typeof value !== 'string') return { value: null };
    const trimmed = value.trim();
    if (!trimmed) return { value: null };
    if (trimmed.length > 500) return { value: null };
    return { value: trimmed };
};

const resolveAvatarUrl = (filename) => `/uploads/avatars/${filename}`;
const isLocalAvatarUrl = (value) => typeof value === 'string' && value.startsWith('/uploads/avatars/');
const resolveLocalAvatarPath = (value) => {
    if (!isLocalAvatarUrl(value)) return null;
    const trimmed = value.replace(/^\/+/, '');
    if (!trimmed.startsWith('uploads/avatars/')) return null;
    return path.join(PUBLIC_DIR, trimmed);
};

const splitFullName = (value) => {
    if (!value || typeof value !== 'string') return { first: null, last: null };
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { first: null, last: null };
    if (parts.length === 1) return { first: parts[0], last: parts[0] };
    return { first: parts[0], last: parts.slice(1).join(' ') };
};

const normalizeDisplayName = (value) => {
    if (value === undefined || value === null) return { value: null };
    if (typeof value !== 'string') return { error: 'Display name must be a string.' };
    const trimmed = value.trim();
    if (!trimmed) return { value: null };
    if (trimmed.length < 2 || trimmed.length > 60) {
        return { error: 'Display name must be between 2 and 60 characters.' };
    }
    return { value: trimmed };
};

const validatePassword = (email, password) => {
    const errors = [];
    if (typeof password !== 'string') {
        return ['Invalid password.'];
    }
    if (password.length < 9) {
        errors.push('Password must be at least 9 characters.');
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
    return errors;
};

const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATAR_UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png';
        const suffix = crypto.randomBytes(6).toString('hex');
        const fileName = `avatar-${Date.now()}-${suffix}${safeExt}`;
        cb(null, fileName);
    }
});
const avatarUpload = multer({
    storage: avatarStorage,
    limits: { fileSize: MAX_AVATAR_SIZE },
    fileFilter: (req, file, cb) => {
        if (!AVATAR_MIME_TYPES.has(file.mimetype)) {
            return cb(new Error('INVALID_AVATAR_TYPE'));
        }
        return cb(null, true);
    }
});

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

const authRequiredApi = (req, res, next) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Not authenticated.' });
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        return next();
    } catch (err) {
        res.clearCookie(COOKIE_NAME);
        return res.status(401).json({ error: 'Not authenticated.' });
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
app.get('/dashboard', authRequired, (req, res) => {
    ensureCsrfCookie(req, res);
    return res.sendFile(path.join(ROOT_DIR, 'dashboard.html'));
});
app.get('/orlando.html', (req, res) => res.redirect('/dashboard'));

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
    const rawDisplayName = tokenInfoResponse.data && tokenInfoResponse.data.name;
    const givenName = tokenInfoResponse.data && tokenInfoResponse.data.given_name;
    const familyName = tokenInfoResponse.data && tokenInfoResponse.data.family_name;
    const avatarUrlRaw = tokenInfoResponse.data && tokenInfoResponse.data.picture;
    const nameParts = splitFullName(rawDisplayName);
    const emailPrefix = email ? email.split('@')[0] : null;
    const firstNameResult = normalizeOptionalName(givenName || nameParts.first || emailPrefix);
    const lastNameResult = normalizeOptionalName(familyName || nameParts.last || (firstNameResult.value || emailPrefix));
    const firstNameValue = firstNameResult.error || !firstNameResult.value
        ? (emailPrefix || 'User')
        : firstNameResult.value;
    const lastNameValue = lastNameResult.error || !lastNameResult.value
        ? firstNameValue
        : lastNameResult.value;
    const displayNameSource = rawDisplayName || emailPrefix || `${firstNameValue} ${lastNameValue}`.trim();
    const displayNameResult = normalizeDisplayName(displayNameSource);
    const fallbackDisplayNameResult = normalizeDisplayName(emailPrefix);
    const normalizedDisplayName = displayNameResult.error || !displayNameResult.value
        ? (fallbackDisplayNameResult.error ? null : fallbackDisplayNameResult.value)
        : displayNameResult.value;
    const avatarUrlResult = normalizeOptionalUrl(avatarUrlRaw);
    const normalizedAvatarUrl = avatarUrlResult.value;
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
            const updates = [];
            const values = [];
            if (!user.first_name) {
                updates.push('first_name = ?');
                values.push(firstNameValue);
            }
            if (!user.last_name) {
                updates.push('last_name = ?');
                values.push(lastNameValue);
            }
            if (!user.display_name && normalizedDisplayName) {
                updates.push('display_name = ?');
                values.push(normalizedDisplayName);
            }
            if (!user.avatar_url && normalizedAvatarUrl) {
                updates.push('avatar_url = ?');
                values.push(normalizedAvatarUrl);
            }
            if (updates.length) {
                values.push(user.id);
                db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
                user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
            }
        } else if (userByEmail) {
            if (userByEmail.google_sub) {
                return res.redirect('/login?google=conflict');
            }
            db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').run(googleSub, userByEmail.id);
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(userByEmail.id);
            const updates = [];
            const values = [];
            if (!user.first_name) {
                updates.push('first_name = ?');
                values.push(firstNameValue);
            }
            if (!user.last_name) {
                updates.push('last_name = ?');
                values.push(lastNameValue);
            }
            if (!user.display_name && normalizedDisplayName) {
                updates.push('display_name = ?');
                values.push(normalizedDisplayName);
            }
            if (!user.avatar_url && normalizedAvatarUrl) {
                updates.push('avatar_url = ?');
                values.push(normalizedAvatarUrl);
            }
            if (updates.length) {
                values.push(user.id);
                db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
                user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
            }
        } else {
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const passwordHash = bcrypt.hashSync(randomPassword, 10);
            const insert = db.prepare(
                'INSERT INTO users (email, password_hash, google_sub, first_name, last_name, display_name, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            insert.run(
                email,
                passwordHash,
                googleSub,
                firstNameValue,
                lastNameValue,
                normalizedDisplayName,
                normalizedAvatarUrl,
                new Date().toISOString()
            );
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

        return res.redirect('/dashboard');
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
        const user = db.prepare(
            'SELECT email, first_name, last_name, display_name, avatar_url FROM users WHERE id = ?'
        ).get(payload.sub);
        if (!user) return res.status(401).json({ error: 'NÃ£o autenticado.' });
        return res.json({
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            displayName: user.display_name,
            avatarUrl: user.avatar_url
        });
    } catch (err) {
        return res.status(401).json({ error: 'Não autenticado.' });
    }
});

app.post('/api/me/avatar', authRequiredApi, requireCsrfToken, (req, res) => {
    avatarUpload.single('avatar')(req, res, (err) => {
        if (err) {
            const message = err.code === 'LIMIT_FILE_SIZE'
                ? 'Avatar must be 2MB or less.'
                : 'Invalid avatar file.';
            return res.status(400).json({ error: message });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'Avatar file is required.' });
        }
        const user = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(req.user.sub);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const newAvatarUrl = resolveAvatarUrl(req.file.filename);
        db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(newAvatarUrl, req.user.sub);

        if (user.avatar_url && user.avatar_url !== newAvatarUrl) {
            const previousPath = resolveLocalAvatarPath(user.avatar_url);
            if (previousPath) {
                fs.unlink(previousPath, () => {});
            }
        }

        return res.json({ ok: true, avatarUrl: newAvatarUrl });
    });
});

const generateTripItemId = () => {
    if (crypto.randomUUID) return crypto.randomUUID();
    return crypto.randomBytes(16).toString('hex');
};

const getTripRecord = db.prepare('SELECT * FROM trips WHERE user_id = ?');
const insertTripRecord = db.prepare(`
    INSERT INTO trips (user_id, name, start_date, end_date, base, family_one, family_two, subtitle, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateTripRecord = db.prepare(`
    UPDATE trips
    SET name = ?, start_date = ?, end_date = ?, base = ?, family_one = ?, family_two = ?, subtitle = ?, updated_at = ?
    WHERE id = ?
`);
const touchTripRecord = db.prepare('UPDATE trips SET updated_at = ? WHERE id = ?');

const getOrCreateTripId = (userId) => {
    const existing = getTripRecord.get(userId);
    if (existing) return existing.id;
    const now = new Date().toISOString();
    const result = insertTripRecord.run(
        userId,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        now,
        now
    );
    return result.lastInsertRowid;
};

const saveTripData = (userId, data) => {
    const trip = data.trip || {};
    const now = new Date().toISOString();
    const existing = getTripRecord.get(userId);
    let tripId = existing ? existing.id : null;

    if (existing) {
        updateTripRecord.run(
            trip.name || null,
            trip.startDate || null,
            trip.endDate || null,
            trip.base || null,
            trip.familyOne || null,
            trip.familyTwo || null,
            trip.subtitle || null,
            now,
            tripId
        );
    } else {
        const result = insertTripRecord.run(
            userId,
            trip.name || null,
            trip.startDate || null,
            trip.endDate || null,
            trip.base || null,
            trip.familyOne || null,
            trip.familyTwo || null,
            trip.subtitle || null,
            now,
            now
        );
        tripId = result.lastInsertRowid;
    }

    const tx = db.transaction(() => {
        db.prepare('DELETE FROM trip_flights WHERE trip_id = ?').run(tripId);
        db.prepare('DELETE FROM trip_lodgings WHERE trip_id = ?').run(tripId);
        db.prepare('DELETE FROM trip_cars WHERE trip_id = ?').run(tripId);
        db.prepare('DELETE FROM trip_expenses WHERE trip_id = ?').run(tripId);
        db.prepare('DELETE FROM trip_transports WHERE trip_id = ?').run(tripId);
        db.prepare('DELETE FROM trip_timeline WHERE trip_id = ?').run(tripId);
        db.prepare('DELETE FROM trip_reminders WHERE trip_id = ?').run(tripId);

        const insertFlight = db.prepare(`
            INSERT INTO trip_flights (id, trip_id, airline, pnr, group_name, cost, currency, from_city, to_city, depart_at, arrive_at, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        (data.flights || []).forEach((item) => {
            insertFlight.run(
                item.id || generateTripItemId(),
                tripId,
                item.airline || null,
                item.pnr || null,
                item.group || null,
                item.cost ?? null,
                item.currency || null,
                item.from || null,
                item.to || null,
                item.departAt || null,
                item.arriveAt || null,
                item.notes || null
            );
        });

        const insertLodging = db.prepare(`
            INSERT INTO trip_lodgings (id, trip_id, name, address, check_in, check_out, cost, currency, host, contact, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        (data.lodgings || []).forEach((item) => {
            insertLodging.run(
                item.id || generateTripItemId(),
                tripId,
                item.name || null,
                item.address || null,
                item.checkIn || null,
                item.checkOut || null,
                item.cost ?? null,
                item.currency || null,
                item.host || null,
                item.contact || null,
                item.notes || null
            );
        });

        const insertCar = db.prepare(`
            INSERT INTO trip_cars (id, trip_id, vehicle, provider, cost, currency, pickup, dropoff, location, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        (data.cars || []).forEach((item) => {
            insertCar.run(
                item.id || generateTripItemId(),
                tripId,
                item.vehicle || null,
                item.provider || null,
                item.cost ?? null,
                item.currency || null,
                item.pickup || null,
                item.dropoff || null,
                item.location || null,
                item.notes || null
            );
        });

        const insertExpense = db.prepare(`
            INSERT INTO trip_expenses (id, trip_id, category, amount, currency, status, due_date, group_name, split, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        (data.expenses || []).forEach((item) => {
            insertExpense.run(
                item.id || generateTripItemId(),
                tripId,
                item.category || null,
                item.amount ?? null,
                item.currency || null,
                item.status || null,
                item.dueDate || null,
                item.group || null,
                item.split || null,
                item.notes || null
            );
        });

        const insertTransport = db.prepare(`
            INSERT INTO trip_transports (id, trip_id, type, date, amount, currency, group_name, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        (data.transports || []).forEach((item) => {
            insertTransport.run(
                item.id || generateTripItemId(),
                tripId,
                item.type || null,
                item.date || null,
                item.amount ?? null,
                item.currency || null,
                item.group || null,
                item.notes || null
            );
        });

        const insertTimeline = db.prepare(`
            INSERT INTO trip_timeline (id, trip_id, date, time, title, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        (data.timeline || []).forEach((item) => {
            insertTimeline.run(
                item.id || generateTripItemId(),
                tripId,
                item.date || null,
                item.time || null,
                item.title || null,
                item.notes || null
            );
        });

        const insertReminder = db.prepare(`
            INSERT INTO trip_reminders (id, trip_id, date, title, description)
            VALUES (?, ?, ?, ?, ?)
        `);
        (data.reminders || []).forEach((item) => {
            insertReminder.run(
                item.id || generateTripItemId(),
                tripId,
                item.date || null,
                item.title || null,
                item.description || null
            );
        });
    });

    tx();
    return { tripId, updatedAt: now };
};

const buildTripPayload = (userId) => {
    const trip = getTripRecord.get(userId);
    if (!trip) return null;
    const tripId = trip.id;

    const flights = db.prepare('SELECT * FROM trip_flights WHERE trip_id = ?').all(tripId);
    const lodgings = db.prepare('SELECT * FROM trip_lodgings WHERE trip_id = ?').all(tripId);
    const cars = db.prepare('SELECT * FROM trip_cars WHERE trip_id = ?').all(tripId);
    const expenses = db.prepare('SELECT * FROM trip_expenses WHERE trip_id = ?').all(tripId);
    const transports = db.prepare('SELECT * FROM trip_transports WHERE trip_id = ?').all(tripId);
    const timeline = db.prepare('SELECT * FROM trip_timeline WHERE trip_id = ?').all(tripId);
    const reminders = db.prepare('SELECT * FROM trip_reminders WHERE trip_id = ?').all(tripId);

    return {
        trip: {
            name: trip.name,
            startDate: trip.start_date,
            endDate: trip.end_date,
            base: trip.base,
            familyOne: trip.family_one,
            familyTwo: trip.family_two,
            subtitle: trip.subtitle
        },
        flights: flights.map((row) => ({
            id: row.id,
            airline: row.airline,
            pnr: row.pnr,
            group: row.group_name,
            cost: row.cost,
            currency: row.currency,
            from: row.from_city,
            to: row.to_city,
            departAt: row.depart_at,
            arriveAt: row.arrive_at,
            notes: row.notes
        })),
        lodgings: lodgings.map((row) => ({
            id: row.id,
            name: row.name,
            address: row.address,
            checkIn: row.check_in,
            checkOut: row.check_out,
            cost: row.cost,
            currency: row.currency,
            host: row.host,
            contact: row.contact,
            notes: row.notes
        })),
        cars: cars.map((row) => ({
            id: row.id,
            vehicle: row.vehicle,
            provider: row.provider,
            cost: row.cost,
            currency: row.currency,
            pickup: row.pickup,
            dropoff: row.dropoff,
            location: row.location,
            notes: row.notes
        })),
        expenses: expenses.map((row) => ({
            id: row.id,
            category: row.category,
            amount: row.amount,
            currency: row.currency,
            status: row.status,
            dueDate: row.due_date,
            group: row.group_name,
            split: row.split,
            notes: row.notes
        })),
        transports: transports.map((row) => ({
            id: row.id,
            type: row.type,
            date: row.date,
            amount: row.amount,
            currency: row.currency,
            group: row.group_name,
            notes: row.notes
        })),
        timeline: timeline.map((row) => ({
            id: row.id,
            date: row.date,
            time: row.time,
            title: row.title,
            notes: row.notes
        })),
        reminders: reminders.map((row) => ({
            id: row.id,
            date: row.date,
            title: row.title,
            description: row.description
        }))
    };
};

app.get('/api/trip', authRequiredApi, (req, res) => {
    const data = buildTripPayload(req.user.sub);
    if (!data) {
        return res.json({ ok: true, data: null });
    }
    return res.json({ ok: true, data });
});

app.post('/api/trip', authRequiredApi, requireCsrfToken, (req, res) => {
    const data = req.body;
    if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Invalid payload.' });
    }
    const result = saveTripData(req.user.sub, data);
    return res.json({ ok: true, updatedAt: result.updatedAt });
});

const mapFlightRow = (row) => ({
    id: row.id,
    airline: row.airline,
    pnr: row.pnr,
    group: row.group_name,
    cost: row.cost,
    currency: row.currency,
    from: row.from_city,
    to: row.to_city,
    departAt: row.depart_at,
    arriveAt: row.arrive_at,
    notes: row.notes
});

const mapLodgingRow = (row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    checkIn: row.check_in,
    checkOut: row.check_out,
    cost: row.cost,
    currency: row.currency,
    host: row.host,
    contact: row.contact,
    notes: row.notes
});

const mapCarRow = (row) => ({
    id: row.id,
    vehicle: row.vehicle,
    provider: row.provider,
    cost: row.cost,
    currency: row.currency,
    pickup: row.pickup,
    dropoff: row.dropoff,
    location: row.location,
    notes: row.notes
});

const mapExpenseRow = (row) => ({
    id: row.id,
    category: row.category,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    dueDate: row.due_date,
    group: row.group_name,
    split: row.split,
    notes: row.notes
});

const mapTransportRow = (row) => ({
    id: row.id,
    type: row.type,
    date: row.date,
    amount: row.amount,
    currency: row.currency,
    group: row.group_name,
    notes: row.notes
});

const mapTimelineRow = (row) => ({
    id: row.id,
    date: row.date,
    time: row.time,
    title: row.title,
    notes: row.notes
});

const mapReminderRow = (row) => ({
    id: row.id,
    date: row.date,
    title: row.title,
    description: row.description
});

const trimString = (value) => (typeof value === 'string' ? value.trim() : '');

const requireString = (value, field) => {
    const trimmed = trimString(value);
    if (!trimmed) {
        return { error: `${field} is required.` };
    }
    return { value: trimmed };
};

const optionalString = (value) => {
    const trimmed = trimString(value);
    return trimmed ? trimmed : null;
};

const requireNumber = (value, field) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return { error: `${field} must be a number.` };
    }
    return { value: number };
};

const requireDate = (value, field) => {
    if (!value || Number.isNaN(Date.parse(value))) {
        return { error: `${field} is invalid.` };
    }
    return { value };
};

const optionalDate = (value, field) => {
    if (!value) return { value: null };
    if (Number.isNaN(Date.parse(value))) {
        return { error: `${field} is invalid.` };
    }
    return { value };
};

const optionalTime = (value, field) => {
    if (!value) return { value: null };
    if (!/^\d{2}:\d{2}/.test(value)) {
        return { error: `${field} is invalid.` };
    }
    return { value };
};

const requireCurrency = (value) => {
    const valid = ['USD', 'CAD', 'BRL'];
    if (!valid.includes(value)) {
        return { error: 'Currency is invalid.' };
    }
    return { value };
};

const requireStatus = (value) => {
    const valid = ['planned', 'paid', 'due'];
    if (!valid.includes(value)) {
        return { error: 'Status is invalid.' };
    }
    return { value };
};

const validateFlightPayload = (payload) => {
    const airline = requireString(payload.airline, 'Airline');
    if (airline.error) return airline;
    const fromCity = requireString(payload.from, 'From');
    if (fromCity.error) return fromCity;
    const toCity = requireString(payload.to, 'To');
    if (toCity.error) return toCity;
    const departAt = requireDate(payload.departAt, 'Departure');
    if (departAt.error) return departAt;
    const arriveAt = requireDate(payload.arriveAt, 'Arrival');
    if (arriveAt.error) return arriveAt;
    const currency = requireCurrency(payload.currency);
    if (currency.error) return currency;
    const cost = requireNumber(payload.cost, 'Cost');
    if (cost.error) return cost;
    return {
        value: {
            airline: airline.value,
            pnr: optionalString(payload.pnr),
            group: optionalString(payload.group),
            cost: cost.value,
            currency: currency.value,
            from: fromCity.value,
            to: toCity.value,
            departAt: departAt.value,
            arriveAt: arriveAt.value,
            notes: optionalString(payload.notes)
        }
    };
};

const validateLodgingPayload = (payload) => {
    const name = requireString(payload.name, 'Property');
    if (name.error) return name;
    const address = requireString(payload.address, 'Address');
    if (address.error) return address;
    const checkIn = requireDate(payload.checkIn, 'Check-in');
    if (checkIn.error) return checkIn;
    const checkOut = requireDate(payload.checkOut, 'Check-out');
    if (checkOut.error) return checkOut;
    const currency = requireCurrency(payload.currency);
    if (currency.error) return currency;
    const cost = requireNumber(payload.cost, 'Total cost');
    if (cost.error) return cost;
    return {
        value: {
            name: name.value,
            address: address.value,
            checkIn: checkIn.value,
            checkOut: checkOut.value,
            cost: cost.value,
            currency: currency.value,
            host: optionalString(payload.host),
            contact: optionalString(payload.contact),
            notes: optionalString(payload.notes)
        }
    };
};

const validateCarPayload = (payload) => {
    const vehicle = requireString(payload.vehicle, 'Vehicle');
    if (vehicle.error) return vehicle;
    const currency = requireCurrency(payload.currency);
    if (currency.error) return currency;
    const cost = requireNumber(payload.cost, 'Total cost');
    if (cost.error) return cost;
    const pickup = requireDate(payload.pickup, 'Pickup');
    if (pickup.error) return pickup;
    const dropoff = requireDate(payload.dropoff, 'Drop-off');
    if (dropoff.error) return dropoff;
    return {
        value: {
            vehicle: vehicle.value,
            provider: optionalString(payload.provider),
            cost: cost.value,
            currency: currency.value,
            pickup: pickup.value,
            dropoff: dropoff.value,
            location: optionalString(payload.location),
            notes: optionalString(payload.notes)
        }
    };
};

const validateExpensePayload = (payload) => {
    const category = requireString(payload.category, 'Category');
    if (category.error) return category;
    const currency = requireCurrency(payload.currency);
    if (currency.error) return currency;
    const amount = requireNumber(payload.amount, 'Amount');
    if (amount.error) return amount;
    const status = requireStatus(payload.status);
    if (status.error) return status;
    const dueDate = optionalDate(payload.dueDate, 'Due date');
    if (dueDate.error) return dueDate;
    return {
        value: {
            category: category.value,
            amount: amount.value,
            currency: currency.value,
            status: status.value,
            dueDate: dueDate.value,
            group: optionalString(payload.group),
            split: optionalString(payload.split),
            notes: optionalString(payload.notes)
        }
    };
};

const validateTransportPayload = (payload) => {
    const type = requireString(payload.type, 'Type');
    if (type.error) return type;
    const date = requireDate(payload.date, 'Date');
    if (date.error) return date;
    const currency = requireCurrency(payload.currency);
    if (currency.error) return currency;
    const amount = requireNumber(payload.amount, 'Amount');
    if (amount.error) return amount;
    return {
        value: {
            type: type.value,
            date: date.value,
            amount: amount.value,
            currency: currency.value,
            group: optionalString(payload.group),
            notes: optionalString(payload.notes)
        }
    };
};

const validateTimelinePayload = (payload) => {
    const date = requireDate(payload.date, 'Date');
    if (date.error) return date;
    const title = requireString(payload.title, 'Title');
    if (title.error) return title;
    const time = optionalTime(payload.time, 'Time');
    if (time.error) return time;
    return {
        value: {
            date: date.value,
            time: time.value,
            title: title.value,
            notes: optionalString(payload.notes)
        }
    };
};

const validateReminderPayload = (payload) => {
    const date = requireDate(payload.date, 'When');
    if (date.error) return date;
    const title = requireString(payload.title, 'Item');
    if (title.error) return title;
    return {
        value: {
            date: date.value,
            title: title.value,
            description: optionalString(payload.description)
        }
    };
};

const validateTripMetaPayload = (payload, current) => {
    return {
        value: {
            name: optionalString(payload.name) || current.name,
            startDate: optionalString(payload.startDate) || current.start_date,
            endDate: optionalString(payload.endDate) || current.end_date,
            base: optionalString(payload.base) || current.base,
            familyOne: optionalString(payload.familyOne) || current.family_one,
            familyTwo: optionalString(payload.familyTwo) || current.family_two,
            subtitle: optionalString(payload.subtitle) || current.subtitle
        }
    };
};

const fetchTripId = (userId) => {
    const trip = getTripRecord.get(userId);
    return trip ? trip.id : null;
};

app.get('/api/trip/meta', authRequiredApi, (req, res) => {
    const trip = getTripRecord.get(req.user.sub);
    if (!trip) return res.json({ ok: true, data: null });
    return res.json({
        ok: true,
        data: {
            name: trip.name,
            startDate: trip.start_date,
            endDate: trip.end_date,
            base: trip.base,
            familyOne: trip.family_one,
            familyTwo: trip.family_two,
            subtitle: trip.subtitle
        }
    });
});

app.put('/api/trip/meta', authRequiredApi, requireCsrfToken, (req, res) => {
    const payload = req.body || {};
    const tripId = getOrCreateTripId(req.user.sub);
    const current = getTripRecord.get(req.user.sub) || {};
    const normalized = validateTripMetaPayload(payload, current);
    updateTripRecord.run(
        normalized.value.name || null,
        normalized.value.startDate || null,
        normalized.value.endDate || null,
        normalized.value.base || null,
        normalized.value.familyOne || null,
        normalized.value.familyTwo || null,
        normalized.value.subtitle || null,
        new Date().toISOString(),
        tripId
    );
    return res.json({ ok: true });
});

app.get('/api/trip/flights', authRequiredApi, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.json({ ok: true, data: [] });
    const rows = db.prepare('SELECT * FROM trip_flights WHERE trip_id = ?').all(tripId);
    return res.json({ ok: true, data: rows.map(mapFlightRow) });
});

app.post('/api/trip/flights', authRequiredApi, requireCsrfToken, (req, res) => {
    const payload = req.body || {};
    const normalized = validateFlightPayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const tripId = getOrCreateTripId(req.user.sub);
    const id = payload.id || generateTripItemId();
    db.prepare(`
        INSERT INTO trip_flights (id, trip_id, airline, pnr, group_name, cost, currency, from_city, to_city, depart_at, arrive_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        tripId,
        normalized.value.airline,
        normalized.value.pnr,
        normalized.value.group,
        normalized.value.cost,
        normalized.value.currency,
        normalized.value.from,
        normalized.value.to,
        normalized.value.departAt,
        normalized.value.arriveAt,
        normalized.value.notes
    );
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true, id });
});

app.put('/api/trip/flights/:id', authRequiredApi, requireCsrfToken, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.status(404).json({ error: 'Trip not found.' });
    const payload = req.body || {};
    const normalized = validateFlightPayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const result = db.prepare(`
        UPDATE trip_flights
        SET airline = ?, pnr = ?, group_name = ?, cost = ?, currency = ?, from_city = ?, to_city = ?, depart_at = ?, arrive_at = ?, notes = ?
        WHERE id = ? AND trip_id = ?
    `).run(
        normalized.value.airline,
        normalized.value.pnr,
        normalized.value.group,
        normalized.value.cost,
        normalized.value.currency,
        normalized.value.from,
        normalized.value.to,
        normalized.value.departAt,
        normalized.value.arriveAt,
        normalized.value.notes,
        req.params.id,
        tripId
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Flight not found.' });
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true });
});

app.delete('/api/trip/flights/:id', authRequiredApi, requireCsrfToken, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.status(404).json({ error: 'Trip not found.' });
    const result = db.prepare('DELETE FROM trip_flights WHERE id = ? AND trip_id = ?').run(req.params.id, tripId);
    if (result.changes === 0) return res.status(404).json({ error: 'Flight not found.' });
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true });
});

app.get('/api/trip/lodgings', authRequiredApi, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.json({ ok: true, data: [] });
    const rows = db.prepare('SELECT * FROM trip_lodgings WHERE trip_id = ?').all(tripId);
    return res.json({ ok: true, data: rows.map(mapLodgingRow) });
});

app.post('/api/trip/lodgings', authRequiredApi, requireCsrfToken, (req, res) => {
    const payload = req.body || {};
    const normalized = validateLodgingPayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const tripId = getOrCreateTripId(req.user.sub);
    const id = payload.id || generateTripItemId();
    db.prepare(`
        INSERT INTO trip_lodgings (id, trip_id, name, address, check_in, check_out, cost, currency, host, contact, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        tripId,
        normalized.value.name,
        normalized.value.address,
        normalized.value.checkIn,
        normalized.value.checkOut,
        normalized.value.cost,
        normalized.value.currency,
        normalized.value.host,
        normalized.value.contact,
        normalized.value.notes
    );
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true, id });
});

app.put('/api/trip/lodgings/:id', authRequiredApi, requireCsrfToken, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.status(404).json({ error: 'Trip not found.' });
    const payload = req.body || {};
    const normalized = validateLodgingPayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const result = db.prepare(`
        UPDATE trip_lodgings
        SET name = ?, address = ?, check_in = ?, check_out = ?, cost = ?, currency = ?, host = ?, contact = ?, notes = ?
        WHERE id = ? AND trip_id = ?
    `).run(
        normalized.value.name,
        normalized.value.address,
        normalized.value.checkIn,
        normalized.value.checkOut,
        normalized.value.cost,
        normalized.value.currency,
        normalized.value.host,
        normalized.value.contact,
        normalized.value.notes,
        req.params.id,
        tripId
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Lodging not found.' });
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true });
});

app.delete('/api/trip/lodgings/:id', authRequiredApi, requireCsrfToken, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.status(404).json({ error: 'Trip not found.' });
    const result = db.prepare('DELETE FROM trip_lodgings WHERE id = ? AND trip_id = ?').run(req.params.id, tripId);
    if (result.changes === 0) return res.status(404).json({ error: 'Lodging not found.' });
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true });
});

app.get('/api/trip/cars', authRequiredApi, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.json({ ok: true, data: [] });
    const rows = db.prepare('SELECT * FROM trip_cars WHERE trip_id = ?').all(tripId);
    return res.json({ ok: true, data: rows.map(mapCarRow) });
});

app.post('/api/trip/cars', authRequiredApi, requireCsrfToken, (req, res) => {
    const payload = req.body || {};
    const normalized = validateCarPayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const tripId = getOrCreateTripId(req.user.sub);
    const id = payload.id || generateTripItemId();
    db.prepare(`
        INSERT INTO trip_cars (id, trip_id, vehicle, provider, cost, currency, pickup, dropoff, location, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        tripId,
        normalized.value.vehicle,
        normalized.value.provider,
        normalized.value.cost,
        normalized.value.currency,
        normalized.value.pickup,
        normalized.value.dropoff,
        normalized.value.location,
        normalized.value.notes
    );
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true, id });
});

app.put('/api/trip/cars/:id', authRequiredApi, requireCsrfToken, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.status(404).json({ error: 'Trip not found.' });
    const payload = req.body || {};
    const normalized = validateCarPayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const result = db.prepare(`
        UPDATE trip_cars
        SET vehicle = ?, provider = ?, cost = ?, currency = ?, pickup = ?, dropoff = ?, location = ?, notes = ?
        WHERE id = ? AND trip_id = ?
    `).run(
        normalized.value.vehicle,
        normalized.value.provider,
        normalized.value.cost,
        normalized.value.currency,
        normalized.value.pickup,
        normalized.value.dropoff,
        normalized.value.location,
        normalized.value.notes,
        req.params.id,
        tripId
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Car not found.' });
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true });
});

app.delete('/api/trip/cars/:id', authRequiredApi, requireCsrfToken, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.status(404).json({ error: 'Trip not found.' });
    const result = db.prepare('DELETE FROM trip_cars WHERE id = ? AND trip_id = ?').run(req.params.id, tripId);
    if (result.changes === 0) return res.status(404).json({ error: 'Car not found.' });
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true });
});

app.get('/api/trip/expenses', authRequiredApi, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.json({ ok: true, data: [] });
    const rows = db.prepare('SELECT * FROM trip_expenses WHERE trip_id = ?').all(tripId);
    return res.json({ ok: true, data: rows.map(mapExpenseRow) });
});

app.post('/api/trip/expenses', authRequiredApi, requireCsrfToken, (req, res) => {
    const payload = req.body || {};
    const normalized = validateExpensePayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const tripId = getOrCreateTripId(req.user.sub);
    const id = payload.id || generateTripItemId();
    db.prepare(`
        INSERT INTO trip_expenses (id, trip_id, category, amount, currency, status, due_date, group_name, split, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        tripId,
        normalized.value.category,
        normalized.value.amount,
        normalized.value.currency,
        normalized.value.status,
        normalized.value.dueDate,
        normalized.value.group,
        normalized.value.split,
        normalized.value.notes
    );
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true, id });
});

app.put('/api/trip/expenses/:id', authRequiredApi, requireCsrfToken, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.status(404).json({ error: 'Trip not found.' });
    const payload = req.body || {};
    const normalized = validateExpensePayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const result = db.prepare(`
        UPDATE trip_expenses
        SET category = ?, amount = ?, currency = ?, status = ?, due_date = ?, group_name = ?, split = ?, notes = ?
        WHERE id = ? AND trip_id = ?
    `).run(
        normalized.value.category,
        normalized.value.amount,
        normalized.value.currency,
        normalized.value.status,
        normalized.value.dueDate,
        normalized.value.group,
        normalized.value.split,
        normalized.value.notes,
        req.params.id,
        tripId
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Expense not found.' });
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true });
});

app.delete('/api/trip/expenses/:id', authRequiredApi, requireCsrfToken, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.status(404).json({ error: 'Trip not found.' });
    const result = db.prepare('DELETE FROM trip_expenses WHERE id = ? AND trip_id = ?').run(req.params.id, tripId);
    if (result.changes === 0) return res.status(404).json({ error: 'Expense not found.' });
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true });
});

app.get('/api/trip/transports', authRequiredApi, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.json({ ok: true, data: [] });
    const rows = db.prepare('SELECT * FROM trip_transports WHERE trip_id = ?').all(tripId);
    return res.json({ ok: true, data: rows.map(mapTransportRow) });
});

app.post('/api/trip/transports', authRequiredApi, requireCsrfToken, (req, res) => {
    const payload = req.body || {};
    const normalized = validateTransportPayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const tripId = getOrCreateTripId(req.user.sub);
    const id = payload.id || generateTripItemId();
    db.prepare(`
        INSERT INTO trip_transports (id, trip_id, type, date, amount, currency, group_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        tripId,
        normalized.value.type,
        normalized.value.date,
        normalized.value.amount,
        normalized.value.currency,
        normalized.value.group,
        normalized.value.notes
    );
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true, id });
});

app.put('/api/trip/transports/:id', authRequiredApi, requireCsrfToken, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.status(404).json({ error: 'Trip not found.' });
    const payload = req.body || {};
    const normalized = validateTransportPayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const result = db.prepare(`
        UPDATE trip_transports
        SET type = ?, date = ?, amount = ?, currency = ?, group_name = ?, notes = ?
        WHERE id = ? AND trip_id = ?
    `).run(
        normalized.value.type,
        normalized.value.date,
        normalized.value.amount,
        normalized.value.currency,
        normalized.value.group,
        normalized.value.notes,
        req.params.id,
        tripId
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Transport not found.' });
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true });
});

app.delete('/api/trip/transports/:id', authRequiredApi, requireCsrfToken, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.status(404).json({ error: 'Trip not found.' });
    const result = db.prepare('DELETE FROM trip_transports WHERE id = ? AND trip_id = ?').run(req.params.id, tripId);
    if (result.changes === 0) return res.status(404).json({ error: 'Transport not found.' });
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true });
});

app.get('/api/trip/timeline', authRequiredApi, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.json({ ok: true, data: [] });
    const rows = db.prepare('SELECT * FROM trip_timeline WHERE trip_id = ?').all(tripId);
    return res.json({ ok: true, data: rows.map(mapTimelineRow) });
});

app.post('/api/trip/timeline', authRequiredApi, requireCsrfToken, (req, res) => {
    const payload = req.body || {};
    const normalized = validateTimelinePayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const tripId = getOrCreateTripId(req.user.sub);
    const id = payload.id || generateTripItemId();
    db.prepare(`
        INSERT INTO trip_timeline (id, trip_id, date, time, title, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        id,
        tripId,
        normalized.value.date,
        normalized.value.time,
        normalized.value.title,
        normalized.value.notes
    );
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true, id });
});

app.put('/api/trip/timeline/:id', authRequiredApi, requireCsrfToken, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.status(404).json({ error: 'Trip not found.' });
    const payload = req.body || {};
    const normalized = validateTimelinePayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const result = db.prepare(`
        UPDATE trip_timeline
        SET date = ?, time = ?, title = ?, notes = ?
        WHERE id = ? AND trip_id = ?
    `).run(
        normalized.value.date,
        normalized.value.time,
        normalized.value.title,
        normalized.value.notes,
        req.params.id,
        tripId
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Timeline item not found.' });
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true });
});

app.delete('/api/trip/timeline/:id', authRequiredApi, requireCsrfToken, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.status(404).json({ error: 'Trip not found.' });
    const result = db.prepare('DELETE FROM trip_timeline WHERE id = ? AND trip_id = ?').run(req.params.id, tripId);
    if (result.changes === 0) return res.status(404).json({ error: 'Timeline item not found.' });
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true });
});

app.get('/api/trip/reminders', authRequiredApi, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.json({ ok: true, data: [] });
    const rows = db.prepare('SELECT * FROM trip_reminders WHERE trip_id = ?').all(tripId);
    return res.json({ ok: true, data: rows.map(mapReminderRow) });
});

app.post('/api/trip/reminders', authRequiredApi, requireCsrfToken, (req, res) => {
    const payload = req.body || {};
    const normalized = validateReminderPayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const tripId = getOrCreateTripId(req.user.sub);
    const id = payload.id || generateTripItemId();
    db.prepare(`
        INSERT INTO trip_reminders (id, trip_id, date, title, description)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        id,
        tripId,
        normalized.value.date,
        normalized.value.title,
        normalized.value.description
    );
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true, id });
});

app.put('/api/trip/reminders/:id', authRequiredApi, requireCsrfToken, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.status(404).json({ error: 'Trip not found.' });
    const payload = req.body || {};
    const normalized = validateReminderPayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const result = db.prepare(`
        UPDATE trip_reminders
        SET date = ?, title = ?, description = ?
        WHERE id = ? AND trip_id = ?
    `).run(
        normalized.value.date,
        normalized.value.title,
        normalized.value.description,
        req.params.id,
        tripId
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Reminder not found.' });
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true });
});

app.delete('/api/trip/reminders/:id', authRequiredApi, requireCsrfToken, (req, res) => {
    const tripId = fetchTripId(req.user.sub);
    if (!tripId) return res.status(404).json({ error: 'Trip not found.' });
    const result = db.prepare('DELETE FROM trip_reminders WHERE id = ? AND trip_id = ?').run(req.params.id, tripId);
    if (result.changes === 0) return res.status(404).json({ error: 'Reminder not found.' });
    touchTripRecord.run(new Date().toISOString(), tripId);
    return res.json({ ok: true });
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
    const { email, password, confirmPassword, firstName, lastName } = req.body || {};
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
        return res.status(400).json({ error: 'Email, first name, last name, password, and confirm password are required.' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email address.' });
    }
    if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match.' });
    }
    const firstNameResult = normalizeName(firstName, 'First name');
    if (firstNameResult.error) {
        return res.status(400).json({ error: firstNameResult.error });
    }
    const lastNameResult = normalizeName(lastName, 'Last name');
    if (lastNameResult.error) {
        return res.status(400).json({ error: lastNameResult.error });
    }
    const passwordErrors = validatePassword(email, password);
    if (passwordErrors.length) {
        return res.status(400).json({ error: passwordErrors[0] });
    }
    const displayName = `${firstNameResult.value} ${lastNameResult.value}`.trim();

    try {
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered.' });
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        const insert = db.prepare(
            'INSERT INTO users (email, password_hash, first_name, last_name, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(
            email,
            passwordHash,
            firstNameResult.value,
            lastNameResult.value,
            displayName,
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
    createTwoFactorCode,
    splitFullName,
    normalizeDisplayName,
    validatePassword,
    validateFlightPayload,
    validateLodgingPayload,
    validateCarPayload,
    validateExpensePayload,
    validateTransportPayload,
    validateTimelinePayload,
    validateReminderPayload,
    validateTripMetaPayload
};
