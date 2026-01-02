const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const COOKIE_NAME = 'auth_token';

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
