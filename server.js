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
const INVITE_TOKEN_TTL_DAYS = Number(process.env.INVITE_TOKEN_TTL_DAYS || 7);

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
    CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        default_currency TEXT NOT NULL,
        created_by_user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        invited_by_user_id INTEGER NOT NULL,
        accepted_by_user_id INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (accepted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS families (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        family_id INTEGER,
        display_name TEXT NOT NULL,
        type TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        date TEXT NOT NULL,
        category TEXT,
        payer_participant_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (payer_participant_id) REFERENCES participants(id) ON DELETE RESTRICT
    );
    CREATE TABLE IF NOT EXISTS expense_splits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER NOT NULL,
        target_type TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS group_flights (
        id TEXT PRIMARY KEY,
        group_id INTEGER NOT NULL,
        expense_id INTEGER,
        airline TEXT,
        airline_id INTEGER,
        flight_number TEXT,
        pnr TEXT,
        cabin_class TEXT,
        status TEXT,
        cost REAL,
        currency TEXT,
        from_city TEXT,
        to_city TEXT,
        from_airport_id INTEGER,
        to_airport_id INTEGER,
        depart_at TEXT,
        arrive_at TEXT,
        notes TEXT,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL,
        FOREIGN KEY (airline_id) REFERENCES airlines(id) ON DELETE SET NULL,
        FOREIGN KEY (from_airport_id) REFERENCES airports(id) ON DELETE SET NULL,
        FOREIGN KEY (to_airport_id) REFERENCES airports(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS group_flight_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        flight_id TEXT NOT NULL,
        participant_id INTEGER NOT NULL,
        seat TEXT,
        baggage TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (flight_id) REFERENCES group_flights(id) ON DELETE CASCADE,
        FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS airlines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS lodging_platforms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS airports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT,
        city TEXT,
        country TEXT,
        name_normalized TEXT,
        city_normalized TEXT
    );
    CREATE TABLE IF NOT EXISTS route_airlines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        airline_name TEXT NOT NULL,
        airline_id INTEGER,
        from_code TEXT NOT NULL,
        to_code TEXT NOT NULL,
        FOREIGN KEY (airline_id) REFERENCES airlines(id) ON DELETE SET NULL,
        UNIQUE (airline_name, from_code, to_code)
    );
    CREATE INDEX IF NOT EXISTS idx_route_airlines_from ON route_airlines(from_code);
    CREATE INDEX IF NOT EXISTS idx_route_airlines_to ON route_airlines(to_code);
    CREATE TABLE IF NOT EXISTS group_lodgings (
        id TEXT PRIMARY KEY,
        group_id INTEGER NOT NULL,
        expense_id INTEGER,
        name TEXT,
        platform TEXT,
        platform_id INTEGER,
        address TEXT,
        address_line2 TEXT,
        city TEXT,
        state TEXT,
        postal_code TEXT,
        country TEXT,
        check_in TEXT,
        check_in_time TEXT,
        check_out TEXT,
        check_out_time TEXT,
        room_type TEXT,
        room_quantity INTEGER,
        room_occupancy INTEGER,
        status TEXT,
        cost REAL,
        currency TEXT,
        host TEXT,
        contact TEXT,
        contact_phone TEXT,
        contact_email TEXT,
        notes TEXT,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL,
        FOREIGN KEY (platform_id) REFERENCES lodging_platforms(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS group_transports (
        id TEXT PRIMARY KEY,
        group_id INTEGER NOT NULL,
        expense_id INTEGER,
        type TEXT,
        origin TEXT,
        destination TEXT,
        depart_at TEXT,
        arrive_at TEXT,
        provider TEXT,
        locator TEXT,
        status TEXT,
        amount REAL,
        currency TEXT,
        notes TEXT,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS group_tickets (
        id TEXT PRIMARY KEY,
        group_id INTEGER NOT NULL,
        expense_id INTEGER,
        type TEXT,
        event_at TEXT,
        location TEXT,
        status TEXT,
        name TEXT,
        date TEXT,
        amount REAL,
        currency TEXT,
        holder TEXT,
        notes TEXT,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS group_ticket_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        ticket_id TEXT NOT NULL,
        participant_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (ticket_id) REFERENCES group_tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
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
const groupFlightColumns = db.prepare('PRAGMA table_info(group_flights)').all();
const hasGroupFlightExpense = groupFlightColumns.some((column) => column.name === 'expense_id');
const hasGroupFlightNumber = groupFlightColumns.some((column) => column.name === 'flight_number');
const hasGroupFlightCabinClass = groupFlightColumns.some((column) => column.name === 'cabin_class');
const hasGroupFlightStatus = groupFlightColumns.some((column) => column.name === 'status');
const hasGroupFlightAirlineId = groupFlightColumns.some((column) => column.name === 'airline_id');
const hasGroupFlightFromAirportId = groupFlightColumns.some((column) => column.name === 'from_airport_id');
const hasGroupFlightToAirportId = groupFlightColumns.some((column) => column.name === 'to_airport_id');
if (!hasGroupFlightExpense) {
    db.exec('ALTER TABLE group_flights ADD COLUMN expense_id INTEGER');
}
if (!hasGroupFlightNumber) {
    db.exec('ALTER TABLE group_flights ADD COLUMN flight_number TEXT');
}
if (!hasGroupFlightCabinClass) {
    db.exec('ALTER TABLE group_flights ADD COLUMN cabin_class TEXT');
}
if (!hasGroupFlightStatus) {
    db.exec('ALTER TABLE group_flights ADD COLUMN status TEXT');
}
if (!hasGroupFlightAirlineId) {
    db.exec('ALTER TABLE group_flights ADD COLUMN airline_id INTEGER');
}
if (!hasGroupFlightFromAirportId) {
    db.exec('ALTER TABLE group_flights ADD COLUMN from_airport_id INTEGER');
}
if (!hasGroupFlightToAirportId) {
    db.exec('ALTER TABLE group_flights ADD COLUMN to_airport_id INTEGER');
}
const groupFlightParticipantColumns = db.prepare('PRAGMA table_info(group_flight_participants)').all();
const hasGroupFlightParticipantSeat = groupFlightParticipantColumns.some((column) => column.name === 'seat');
const hasGroupFlightParticipantBaggage = groupFlightParticipantColumns.some((column) => column.name === 'baggage');
if (!hasGroupFlightParticipantSeat) {
    db.exec('ALTER TABLE group_flight_participants ADD COLUMN seat TEXT');
}
if (!hasGroupFlightParticipantBaggage) {
    db.exec('ALTER TABLE group_flight_participants ADD COLUMN baggage TEXT');
}
const airportColumns = db.prepare('PRAGMA table_info(airports)').all();
const hasAirportNameNormalized = airportColumns.some((column) => column.name === 'name_normalized');
const hasAirportCityNormalized = airportColumns.some((column) => column.name === 'city_normalized');
if (!hasAirportNameNormalized) {
    db.exec('ALTER TABLE airports ADD COLUMN name_normalized TEXT');
}
if (!hasAirportCityNormalized) {
    db.exec('ALTER TABLE airports ADD COLUMN city_normalized TEXT');
}
const groupLodgingColumns = db.prepare('PRAGMA table_info(group_lodgings)').all();
const hasGroupLodgingExpense = groupLodgingColumns.some((column) => column.name === 'expense_id');
const hasGroupLodgingPlatform = groupLodgingColumns.some((column) => column.name === 'platform');
const hasGroupLodgingPlatformId = groupLodgingColumns.some((column) => column.name === 'platform_id');
const hasGroupLodgingAddressLine2 = groupLodgingColumns.some((column) => column.name === 'address_line2');
const hasGroupLodgingCity = groupLodgingColumns.some((column) => column.name === 'city');
const hasGroupLodgingState = groupLodgingColumns.some((column) => column.name === 'state');
const hasGroupLodgingPostalCode = groupLodgingColumns.some((column) => column.name === 'postal_code');
const hasGroupLodgingCountry = groupLodgingColumns.some((column) => column.name === 'country');
const hasGroupLodgingCheckInTime = groupLodgingColumns.some((column) => column.name === 'check_in_time');
const hasGroupLodgingCheckOutTime = groupLodgingColumns.some((column) => column.name === 'check_out_time');
const hasGroupLodgingRoomType = groupLodgingColumns.some((column) => column.name === 'room_type');
const hasGroupLodgingRoomQuantity = groupLodgingColumns.some((column) => column.name === 'room_quantity');
const hasGroupLodgingRoomOccupancy = groupLodgingColumns.some((column) => column.name === 'room_occupancy');
const hasGroupLodgingStatus = groupLodgingColumns.some((column) => column.name === 'status');
const hasGroupLodgingContactPhone = groupLodgingColumns.some((column) => column.name === 'contact_phone');
const hasGroupLodgingContactEmail = groupLodgingColumns.some((column) => column.name === 'contact_email');
if (!hasGroupLodgingExpense) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN expense_id INTEGER');
}
if (!hasGroupLodgingPlatform) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN platform TEXT');
}
if (!hasGroupLodgingPlatformId) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN platform_id INTEGER');
}
if (!hasGroupLodgingAddressLine2) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN address_line2 TEXT');
}
if (!hasGroupLodgingCity) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN city TEXT');
}
if (!hasGroupLodgingState) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN state TEXT');
}
if (!hasGroupLodgingPostalCode) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN postal_code TEXT');
}
if (!hasGroupLodgingCountry) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN country TEXT');
}
if (!hasGroupLodgingCheckInTime) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN check_in_time TEXT');
}
if (!hasGroupLodgingCheckOutTime) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN check_out_time TEXT');
}
if (!hasGroupLodgingRoomType) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN room_type TEXT');
}
if (!hasGroupLodgingRoomQuantity) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN room_quantity INTEGER');
}
if (!hasGroupLodgingRoomOccupancy) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN room_occupancy INTEGER');
}
if (!hasGroupLodgingStatus) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN status TEXT');
}
if (!hasGroupLodgingContactPhone) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN contact_phone TEXT');
}
if (!hasGroupLodgingContactEmail) {
    db.exec('ALTER TABLE group_lodgings ADD COLUMN contact_email TEXT');
}
const groupTransportColumns = db.prepare('PRAGMA table_info(group_transports)').all();
const hasGroupTransportExpense = groupTransportColumns.some((column) => column.name === 'expense_id');
const hasGroupTransportOrigin = groupTransportColumns.some((column) => column.name === 'origin');
const hasGroupTransportDestination = groupTransportColumns.some((column) => column.name === 'destination');
const hasGroupTransportDepartAt = groupTransportColumns.some((column) => column.name === 'depart_at');
const hasGroupTransportArriveAt = groupTransportColumns.some((column) => column.name === 'arrive_at');
const hasGroupTransportProvider = groupTransportColumns.some((column) => column.name === 'provider');
const hasGroupTransportLocator = groupTransportColumns.some((column) => column.name === 'locator');
const hasGroupTransportStatus = groupTransportColumns.some((column) => column.name === 'status');
if (!hasGroupTransportExpense) {
    db.exec('ALTER TABLE group_transports ADD COLUMN expense_id INTEGER');
}
if (!hasGroupTransportOrigin) {
    db.exec('ALTER TABLE group_transports ADD COLUMN origin TEXT');
}
if (!hasGroupTransportDestination) {
    db.exec('ALTER TABLE group_transports ADD COLUMN destination TEXT');
}
if (!hasGroupTransportDepartAt) {
    db.exec('ALTER TABLE group_transports ADD COLUMN depart_at TEXT');
}
if (!hasGroupTransportArriveAt) {
    db.exec('ALTER TABLE group_transports ADD COLUMN arrive_at TEXT');
}
if (!hasGroupTransportProvider) {
    db.exec('ALTER TABLE group_transports ADD COLUMN provider TEXT');
}
if (!hasGroupTransportLocator) {
    db.exec('ALTER TABLE group_transports ADD COLUMN locator TEXT');
}
if (!hasGroupTransportStatus) {
    db.exec('ALTER TABLE group_transports ADD COLUMN status TEXT');
}
const groupTicketColumns = db.prepare('PRAGMA table_info(group_tickets)').all();
const hasGroupTicketExpense = groupTicketColumns.some((column) => column.name === 'expense_id');
if (!hasGroupTicketExpense) {
    db.exec('ALTER TABLE group_tickets ADD COLUMN expense_id INTEGER');
}
const hasGroupTicketType = groupTicketColumns.some((column) => column.name === 'type');
if (!hasGroupTicketType) {
    db.exec('ALTER TABLE group_tickets ADD COLUMN type TEXT');
}
const hasGroupTicketEventAt = groupTicketColumns.some((column) => column.name === 'event_at');
if (!hasGroupTicketEventAt) {
    db.exec('ALTER TABLE group_tickets ADD COLUMN event_at TEXT');
}
const hasGroupTicketLocation = groupTicketColumns.some((column) => column.name === 'location');
if (!hasGroupTicketLocation) {
    db.exec('ALTER TABLE group_tickets ADD COLUMN location TEXT');
}
const hasGroupTicketStatus = groupTicketColumns.some((column) => column.name === 'status');
if (!hasGroupTicketStatus) {
    db.exec('ALTER TABLE group_tickets ADD COLUMN status TEXT');
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL');
db.exec('CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_two_factor_codes_user ON two_factor_codes(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash ON reset_tokens(token_hash)');
db.exec('CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_hash ON email_verification_tokens(token_hash)');
db.exec('CREATE INDEX IF NOT EXISTS idx_two_factor_codes_hash ON two_factor_codes(code_hash)');
db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_unique ON group_members(group_id, user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id)');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token)');
db.exec('CREATE INDEX IF NOT EXISTS idx_invitations_group ON invitations(group_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_families_group ON families(group_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_participants_group ON participants(group_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_participants_family ON participants(family_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_expenses_payer ON expenses(payer_participant_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_group_flights_group ON group_flights(group_id)');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_group_flight_participants_unique ON group_flight_participants(flight_id, participant_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_group_flight_participants_group ON group_flight_participants(group_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_group_flight_participants_flight ON group_flight_participants(flight_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_group_flight_participants_participant ON group_flight_participants(participant_id)');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_group_ticket_participants_unique ON group_ticket_participants(ticket_id, participant_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_group_ticket_participants_group ON group_ticket_participants(group_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_group_ticket_participants_ticket ON group_ticket_participants(ticket_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_group_ticket_participants_participant ON group_ticket_participants(participant_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_group_lodgings_group ON group_lodgings(group_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_group_transports_group ON group_transports(group_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_group_tickets_group ON group_tickets(group_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id)');
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
app.get('/groups', authRequired, (req, res) => {
    ensureCsrfCookie(req, res);
    return res.sendFile(path.join(PUBLIC_DIR, 'groups.html'));
});
app.get('/dashboard', authRequired, (req, res) => {
    ensureCsrfCookie(req, res);
    return res.sendFile(path.join(PUBLIC_DIR, 'group.html'));
});

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

        return res.redirect('/groups');
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

const INVITABLE_ROLES = ['admin', 'member', 'viewer'];

const parseGroupId = (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

const queryAirportCodes = (input) => {
    if (!input) return [];
    const trimmed = input.trim();
    if (!trimmed) return [];
    const upper = trimmed.toUpperCase();
    const like = `%${upper}%`;
    const rows = findAirportCodesStmt.all(upper, like, like);
    const codes = rows.map((row) => row.code).filter(Boolean);
    if (!codes.length && upper.length === 3) {
        codes.push(upper);
    }
    return Array.from(new Set(codes));
};

const fetchRouteAirlines = (fromCodes, toCodes) => {
    if (!fromCodes.length || !toCodes.length) return [];
    const clauses = [];
    const params = [];
    const placeholders = (arr) => arr.map(() => '?').join(', ');
    const upperArray = (arr) => arr.map((value) => value.toUpperCase());
    if (fromCodes.length) {
        clauses.push(`UPPER(from_code) IN (${placeholders(fromCodes)})`);
        params.push(...upperArray(fromCodes));
    }
    if (toCodes.length) {
        clauses.push(`UPPER(to_code) IN (${placeholders(toCodes)})`);
        params.push(...upperArray(toCodes));
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const stmt = db.prepare(`
        SELECT DISTINCT COALESCE(airlines.name, route_airlines.airline_name) AS name
        FROM route_airlines
        LEFT JOIN airlines ON airlines.id = route_airlines.airline_id
        ${where}
        ORDER BY name
    `);
    return stmt.all(...params).map((row) => row.name);
};
const ensureAirlineId = (name, candidateId) => {
    const trimmed = trimString(name);
    if (!trimmed) return null;
    const normalized = trimmed.toLowerCase();
    return db.transaction(() => {
        const preferred = parseGroupId(candidateId);
        if (preferred) {
            const existing = getAirlineById.get(preferred);
            if (existing && existing.name.toLowerCase() === normalized) {
                return existing.id;
            }
        }
        const byName = findAirlineByName.get(normalized);
        if (byName) {
            return byName.id;
        }
        const result = insertAirline.run(trimmed);
        return Number(result.lastInsertRowid);
    })();
};
const ensureLodgingPlatformId = (name, candidateId) => {
    const trimmed = trimString(name);
    if (!trimmed) return null;
    const normalized = trimmed.toLowerCase();
    return db.transaction(() => {
        const preferred = parseGroupId(candidateId);
        if (preferred) {
            const existing = getLodgingPlatformById.get(preferred);
            if (existing && existing.name.toLowerCase() === normalized) {
                return existing.id;
            }
        }
        const byName = findLodgingPlatformByName.get(normalized);
        if (byName) {
            return byName.id;
        }
        const result = insertLodgingPlatform.run(trimmed);
        return Number(result.lastInsertRowid);
    })();
};

const getGroupById = db.prepare('SELECT * FROM groups WHERE id = ?');
const getGroupMember = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?');
const listGroupsForUser = db.prepare(`
    SELECT g.id, g.name, g.default_currency, g.created_by_user_id, g.created_at, gm.role
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.user_id = ?
    ORDER BY g.created_at DESC
`);
const insertGroup = db.prepare(`
    INSERT INTO groups (name, default_currency, created_by_user_id, created_at)
    VALUES (?, ?, ?, ?)
`);
const insertGroupMember = db.prepare(`
    INSERT INTO group_members (group_id, user_id, role, created_at)
    VALUES (?, ?, ?, ?)
`);
const insertGroupMemberIfMissing = db.prepare(`
    INSERT OR IGNORE INTO group_members (group_id, user_id, role, created_at)
    VALUES (?, ?, ?, ?)
`);
const listGroupMembers = db.prepare(`
    SELECT gm.role, u.id as user_id, u.email, u.first_name, u.last_name, u.display_name
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ?
    ORDER BY u.first_name, u.last_name, u.email
`);
const listFamilies = db.prepare(`
    SELECT id, name, created_at
    FROM families
    WHERE group_id = ?
    ORDER BY name
`);
const getFamily = db.prepare('SELECT id, name FROM families WHERE id = ? AND group_id = ?');
const insertFamily = db.prepare(`
    INSERT INTO families (group_id, name, created_at)
    VALUES (?, ?, ?)
`);
const updateFamily = db.prepare(`
    UPDATE families
    SET name = ?
    WHERE id = ? AND group_id = ?
`);
const deleteFamily = db.prepare('DELETE FROM families WHERE id = ? AND group_id = ?');
const listParticipants = db.prepare(`
    SELECT id, family_id, display_name, type, created_at
    FROM participants
    WHERE group_id = ?
    ORDER BY display_name
`);
const getParticipant = db.prepare('SELECT id FROM participants WHERE id = ? AND group_id = ?');
const insertParticipant = db.prepare(`
    INSERT INTO participants (group_id, family_id, display_name, type, created_at)
    VALUES (?, ?, ?, ?, ?)
`);
const updateParticipant = db.prepare(`
    UPDATE participants
    SET family_id = ?, display_name = ?, type = ?
    WHERE id = ? AND group_id = ?
`);
const deleteParticipant = db.prepare('DELETE FROM participants WHERE id = ? AND group_id = ?');
const countExpensesWithPayer = db.prepare(`
    SELECT COUNT(*) as count
    FROM expenses
    WHERE payer_participant_id = ? AND group_id = ?
`);
const countParticipantExpenseSplits = db.prepare(`
    SELECT COUNT(*) as count
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    WHERE es.target_type = 'participant'
      AND es.target_id = ?
      AND e.group_id = ?
`);
const countParticipantsByFamily = db.prepare(`
    SELECT COUNT(*) as count
    FROM participants
    WHERE family_id = ? AND group_id = ?
`);
const listExpenses = db.prepare(`
    SELECT id, description, amount, currency, date, category, payer_participant_id, created_at
    FROM expenses
    WHERE group_id = ?
    ORDER BY date DESC, id DESC
`);
const getExpense = db.prepare('SELECT id FROM expenses WHERE id = ? AND group_id = ?');
const insertExpense = db.prepare(`
    INSERT INTO expenses (group_id, description, amount, currency, date, category, payer_participant_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateExpense = db.prepare(`
    UPDATE expenses
    SET description = ?, amount = ?, currency = ?, date = ?, category = ?, payer_participant_id = ?
    WHERE id = ? AND group_id = ?
`);
const deleteExpense = db.prepare('DELETE FROM expenses WHERE id = ? AND group_id = ?');
const listExpenseSplits = db.prepare(`
    SELECT target_type, target_id, amount
    FROM expense_splits
    WHERE expense_id = ?
    ORDER BY id
`);
const insertExpenseSplit = db.prepare(`
    INSERT INTO expense_splits (expense_id, target_type, target_id, amount)
    VALUES (?, ?, ?, ?)
`);
const deleteExpenseSplits = db.prepare('DELETE FROM expense_splits WHERE expense_id = ?');
const listParticipantIds = db.prepare('SELECT id FROM participants WHERE group_id = ?');
const listFamilyIds = db.prepare('SELECT id FROM families WHERE group_id = ?');
const listGroupFlights = db.prepare(`
    SELECT id, expense_id, airline, airline_id, flight_number, pnr, cabin_class, status,
           cost, currency, from_city, to_city, from_airport_id, to_airport_id, depart_at, arrive_at, notes
    FROM group_flights
    WHERE group_id = ?
    ORDER BY depart_at DESC, id DESC
`);
const getGroupFlight = db.prepare('SELECT id, expense_id FROM group_flights WHERE id = ? AND group_id = ?');
const insertGroupFlight = db.prepare(`
    INSERT INTO group_flights (
        id, group_id, expense_id, airline, airline_id, flight_number, pnr, cabin_class, status,
        cost, currency, from_city, to_city, from_airport_id, to_airport_id, depart_at, arrive_at, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateGroupFlight = db.prepare(`
    UPDATE group_flights
    SET expense_id = ?, airline = ?, airline_id = ?, flight_number = ?, pnr = ?, cabin_class = ?, status = ?,
        cost = ?, currency = ?, from_city = ?, to_city = ?, from_airport_id = ?, to_airport_id = ?,
        depart_at = ?, arrive_at = ?, notes = ?
    WHERE id = ? AND group_id = ?
`);
const deleteGroupFlight = db.prepare('DELETE FROM group_flights WHERE id = ? AND group_id = ?');
const listGroupFlightParticipants = db.prepare(`
    SELECT flight_id, participant_id, seat, baggage
    FROM group_flight_participants
    WHERE group_id = ?
    ORDER BY id
`);
const insertGroupFlightParticipant = db.prepare(`
    INSERT INTO group_flight_participants (group_id, flight_id, participant_id, seat, baggage, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
`);
const deleteGroupFlightParticipants = db.prepare(`
    DELETE FROM group_flight_participants
    WHERE flight_id = ? AND group_id = ?
`);
const listGroupTicketParticipants = db.prepare(`
    SELECT ticket_id, participant_id
    FROM group_ticket_participants
    WHERE group_id = ?
    ORDER BY id
`);
const insertGroupTicketParticipant = db.prepare(`
    INSERT INTO group_ticket_participants (group_id, ticket_id, participant_id, created_at)
    VALUES (?, ?, ?, ?)
`);
const deleteGroupTicketParticipants = db.prepare(`
    DELETE FROM group_ticket_participants
    WHERE ticket_id = ? AND group_id = ?
`);
const insertRouteAirline = db.prepare(`
    INSERT OR IGNORE INTO route_airlines (airline_name, airline_id, from_code, to_code)
    VALUES (?, ?, ?, ?)
`);
const insertAirport = db.prepare(`
    INSERT OR REPLACE INTO airports (code, name, city, country)
    VALUES (?, ?, ?, ?)
`);
const findAirportCodesStmt = db.prepare(`
    SELECT DISTINCT code FROM airports
    WHERE UPPER(code) = ?
       OR UPPER(city) LIKE ?
       OR UPPER(name) LIKE ?
`);
const listAirportsByQuery = db.prepare(`
    SELECT id, code, name, city, country
    FROM airports
    WHERE UPPER(code) LIKE ?
       OR city_normalized LIKE ?
       OR name_normalized LIKE ?
       OR UPPER(city) LIKE ?
       OR UPPER(name) LIKE ?
    ORDER BY code
    LIMIT 20
`);
const listAirlines = db.prepare('SELECT id, name FROM airlines ORDER BY name');
const getAirlineById = db.prepare('SELECT id, name FROM airlines WHERE id = ?');
const findAirlineByName = db.prepare('SELECT id FROM airlines WHERE LOWER(name) = ?');
const insertAirline = db.prepare('INSERT INTO airlines (name) VALUES (?)');
const listLodgingPlatforms = db.prepare('SELECT id, name FROM lodging_platforms ORDER BY name');
const getLodgingPlatformById = db.prepare('SELECT id, name FROM lodging_platforms WHERE id = ?');
const findLodgingPlatformByName = db.prepare('SELECT id FROM lodging_platforms WHERE LOWER(name) = ?');
const insertLodgingPlatform = db.prepare('INSERT OR IGNORE INTO lodging_platforms (name) VALUES (?)');
const getAirportById = db.prepare('SELECT id, code, name, city, country FROM airports WHERE id = ?');
const defaultLodgingPlatforms = [
    'Booking.com',
    'Airbnb',
    'Expedia',
    'Hotels.com',
    'Agoda',
    'Vrbo',
    'Trip.com',
    'Priceline',
    'Hostelworld',
    'Trivago',
    'Marriott',
    'Hilton',
    'IHG',
    'Accor'
];
const defaultLodgingProperties = [
    'Booking.com',
    'Airbnb',
    'Expedia',
    'Vrbo',
    'Hotels.com',
    'Agoda',
    'Tripadvisor',
    'Trivago',
    'Priceline',
    'Marriott'
];
defaultLodgingPlatforms.forEach((platform) => {
    insertLodgingPlatform.run(platform);
});
const listGroupLodgings = db.prepare(`
    SELECT id, expense_id, name, platform, platform_id, address, address_line2, city, state, postal_code, country,
           check_in, check_in_time, check_out, check_out_time, room_type, room_quantity, room_occupancy,
           status, cost, currency, host, contact, contact_phone, contact_email, notes
    FROM group_lodgings
    WHERE group_id = ?
    ORDER BY check_in DESC, id DESC
`);
const listGroupLodgingProperties = db.prepare(`
    SELECT name, COUNT(*) as usage_count
    FROM group_lodgings
    WHERE group_id = ? AND name IS NOT NULL AND TRIM(name) <> ''
    GROUP BY name
    ORDER BY usage_count DESC, name ASC
    LIMIT ?
`);
const listGroupLodgingCities = db.prepare(`
    SELECT city as name, COUNT(*) as usage_count
    FROM group_lodgings
    WHERE group_id = ? AND LOWER(country) = LOWER(?) AND city IS NOT NULL AND TRIM(city) <> ''
    GROUP BY city
    ORDER BY usage_count DESC, city ASC
    LIMIT ?
`);
const listGroupLodgingStates = db.prepare(`
    SELECT state as name, COUNT(*) as usage_count
    FROM group_lodgings
    WHERE group_id = ? AND LOWER(country) = LOWER(?) AND state IS NOT NULL AND TRIM(state) <> ''
    GROUP BY state
    ORDER BY usage_count DESC, state ASC
    LIMIT ?
`);
const getGroupLodging = db.prepare('SELECT id, expense_id FROM group_lodgings WHERE id = ? AND group_id = ?');
const insertGroupLodging = db.prepare(`
    INSERT INTO group_lodgings (
        id, group_id, expense_id, name, platform, platform_id, address, address_line2, city, state, postal_code, country,
        check_in, check_in_time, check_out, check_out_time, room_type, room_quantity, room_occupancy,
        status, cost, currency, host, contact, contact_phone, contact_email, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateGroupLodging = db.prepare(`
    UPDATE group_lodgings
    SET expense_id = ?, name = ?, platform = ?, platform_id = ?, address = ?, address_line2 = ?, city = ?, state = ?,
        postal_code = ?, country = ?,
        check_in = ?, check_in_time = ?, check_out = ?, check_out_time = ?, room_type = ?, room_quantity = ?,
        room_occupancy = ?, status = ?, cost = ?, currency = ?, host = ?, contact = ?, contact_phone = ?, contact_email = ?,
        notes = ?
    WHERE id = ? AND group_id = ?
`);
const deleteGroupLodging = db.prepare('DELETE FROM group_lodgings WHERE id = ? AND group_id = ?');
const listGroupTransports = db.prepare(`
    SELECT id, expense_id, type, origin, destination, depart_at, arrive_at, provider, locator, status, amount, currency, notes
    FROM group_transports
    WHERE group_id = ?
    ORDER BY depart_at DESC, id DESC
`);
const getGroupTransport = db.prepare('SELECT id, expense_id FROM group_transports WHERE id = ? AND group_id = ?');
const insertGroupTransport = db.prepare(`
    INSERT INTO group_transports (
        id, group_id, expense_id, type, origin, destination, depart_at, arrive_at, provider, locator, status,
        amount, currency, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateGroupTransport = db.prepare(`
    UPDATE group_transports
    SET expense_id = ?, type = ?, origin = ?, destination = ?, depart_at = ?, arrive_at = ?, provider = ?, locator = ?,
        status = ?, amount = ?, currency = ?, notes = ?
    WHERE id = ? AND group_id = ?
`);
const deleteGroupTransport = db.prepare('DELETE FROM group_transports WHERE id = ? AND group_id = ?');
const listGroupTickets = db.prepare(`
    SELECT id, expense_id, type, event_at, location, status, name, date, amount, currency, holder, notes
    FROM group_tickets
    WHERE group_id = ?
    ORDER BY COALESCE(event_at, date) DESC, id DESC
`);
const getGroupTicket = db.prepare('SELECT id, expense_id FROM group_tickets WHERE id = ? AND group_id = ?');
const insertGroupTicket = db.prepare(`
    INSERT INTO group_tickets (
        id, group_id, expense_id, type, event_at, location, status, name, date,
        amount, currency, holder, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateGroupTicket = db.prepare(`
    UPDATE group_tickets
    SET expense_id = ?, type = ?, event_at = ?, location = ?, status = ?, name = ?, date = ?,
        amount = ?, currency = ?, holder = ?, notes = ?
    WHERE id = ? AND group_id = ?
`);
const deleteGroupTicket = db.prepare('DELETE FROM group_tickets WHERE id = ? AND group_id = ?');
const insertInvitation = db.prepare(`
    INSERT INTO invitations
    (group_id, email, role, token, expires_at, status, invited_by_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const getInvitationByToken = db.prepare('SELECT * FROM invitations WHERE token = ?');
const updateInvitationStatus = db.prepare('UPDATE invitations SET status = ?, accepted_by_user_id = ? WHERE id = ?');
const markInvitationExpired = db.prepare('UPDATE invitations SET status = ? WHERE id = ?');
const getUserEmail = db.prepare('SELECT email FROM users WHERE id = ?');

const requireGroupMember = (req, res, next) => {
    const groupId = parseGroupId(req.params.groupId || req.params.id);
    if (!groupId) {
        return res.status(400).json({ error: 'Invalid group id.' });
    }
    const group = getGroupById.get(groupId);
    if (!group) {
        return res.status(404).json({ error: 'Group not found.' });
    }
    const member = getGroupMember.get(groupId, req.user.sub);
    if (!member) {
        return res.status(403).json({ error: 'Not a member of this group.' });
    }
    req.group = group;
    req.groupMember = member;
    req.groupId = groupId;
    return next();
};

const requireGroupRole = (roles) => (req, res, next) => {
    if (!req.groupMember || !roles.includes(req.groupMember.role)) {
        return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    return next();
};

app.post('/api/groups', authRequiredApi, requireCsrfToken, (req, res) => {
    const payload = req.body || {};
    const normalized = validateGroupPayload(payload);
    if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
    }
    const now = new Date().toISOString();
    const result = insertGroup.run(
        normalized.value.name,
        normalized.value.defaultCurrency,
        req.user.sub,
        now
    );
    insertGroupMember.run(result.lastInsertRowid, req.user.sub, 'owner', now);
    return res.json({ ok: true, groupId: result.lastInsertRowid });
});

app.get('/api/groups', authRequiredApi, (req, res) => {
    const groups = listGroupsForUser.all(req.user.sub).map((row) => ({
        id: row.id,
        name: row.name,
        defaultCurrency: row.default_currency,
        createdByUserId: row.created_by_user_id,
        createdAt: row.created_at,
        role: row.role
    }));
    return res.json({ ok: true, data: groups });
});

app.get('/api/groups/:groupId/members', authRequiredApi, requireGroupMember, (req, res) => {
    const members = listGroupMembers.all(req.groupId).map((row) => ({
        userId: row.user_id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        displayName: row.display_name,
        role: row.role
    }));
    return res.json({ ok: true, data: members });
});

app.get('/api/groups/:groupId/families', authRequiredApi, requireGroupMember, (req, res) => {
    const families = listFamilies.all(req.groupId).map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at
    }));
    return res.json({ ok: true, data: families });
});

app.post(
    '/api/groups/:groupId/families',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const normalized = validateFamilyPayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        const now = new Date().toISOString();
        const result = insertFamily.run(req.groupId, normalized.value.name, now);
        return res.json({ ok: true, familyId: result.lastInsertRowid });
    }
);

app.put(
    '/api/groups/:groupId/families/:familyId',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const familyId = parseGroupId(req.params.familyId);
        if (!familyId) {
            return res.status(400).json({ error: 'Invalid family id.' });
        }
        if (!getFamily.get(familyId, req.groupId)) {
            return res.status(404).json({ error: 'Family not found.' });
        }
        const normalized = validateFamilyPayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        updateFamily.run(normalized.value.name, familyId, req.groupId);
        return res.json({ ok: true });
    }
);

app.delete(
    '/api/groups/:groupId/families/:familyId',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const familyId = parseGroupId(req.params.familyId);
        if (!familyId) {
            return res.status(400).json({ error: 'Invalid family id.' });
        }
        if (!getFamily.get(familyId, req.groupId)) {
            return res.status(404).json({ error: 'Family not found.' });
        }
        const usage = countParticipantsByFamily.get(familyId, req.groupId);
        if (usage && usage.count > 0) {
            return res.status(400).json({ error: 'Family has participants.' });
        }
        deleteFamily.run(familyId, req.groupId);
        return res.json({ ok: true });
    }
);

app.get('/api/groups/:groupId/participants', authRequiredApi, requireGroupMember, (req, res) => {
    const participants = listParticipants.all(req.groupId).map((row) => ({
        id: row.id,
        familyId: row.family_id,
        displayName: row.display_name,
        type: row.type,
        createdAt: row.created_at
    }));
    return res.json({ ok: true, data: participants });
});

app.post(
    '/api/groups/:groupId/participants',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const normalized = validateParticipantPayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        if (normalized.value.familyId) {
            const family = getFamily.get(normalized.value.familyId, req.groupId);
            if (!family) {
                return res.status(404).json({ error: 'Family not found.' });
            }
        }
        const now = new Date().toISOString();
        const result = insertParticipant.run(
            req.groupId,
            normalized.value.familyId,
            normalized.value.displayName,
            normalized.value.type,
            now
        );
        return res.json({ ok: true, participantId: result.lastInsertRowid });
    }
);

app.put(
    '/api/groups/:groupId/participants/:participantId',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const participantId = parseGroupId(req.params.participantId);
        if (!participantId) {
            return res.status(400).json({ error: 'Invalid participant id.' });
        }
        if (!getParticipant.get(participantId, req.groupId)) {
            return res.status(404).json({ error: 'Participant not found.' });
        }
        const normalized = validateParticipantPayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        if (normalized.value.familyId) {
            const family = getFamily.get(normalized.value.familyId, req.groupId);
            if (!family) {
                return res.status(404).json({ error: 'Family not found.' });
            }
        }
        updateParticipant.run(
            normalized.value.familyId,
            normalized.value.displayName,
            normalized.value.type,
            participantId,
            req.groupId
        );
        return res.json({ ok: true });
    }
);

app.delete(
    '/api/groups/:groupId/participants/:participantId',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const participantId = parseGroupId(req.params.participantId);
        if (!participantId) {
            return res.status(400).json({ error: 'Invalid participant id.' });
        }
        if (!getParticipant.get(participantId, req.groupId)) {
            return res.status(404).json({ error: 'Participant not found.' });
        }
        const payerCount = countExpensesWithPayer.get(participantId, req.groupId)?.count || 0;
        if (payerCount > 0) {
            return res.status(400).json({ error: 'Participant is a payer in expenses. Reassign or remove those expenses first.' });
        }
        const splitCount = countParticipantExpenseSplits.get(participantId, req.groupId)?.count || 0;
        if (splitCount > 0) {
            return res.status(400).json({ error: 'Participant is included in expense splits. Update those expenses first.' });
        }
        deleteParticipant.run(participantId, req.groupId);
        return res.json({ ok: true });
    }
);

const buildEqualSplits = (totalAmount, targetIds) => {
    const totalCents = Math.round(totalAmount * 100);
    const count = targetIds.length;
    const base = Math.floor(totalCents / count);
    const remainder = totalCents % count;
    return targetIds.map((targetId, index) => ({
        targetId,
        amount: (base + (index < remainder ? 1 : 0)) / 100
    }));
};

const validateSplitSum = (totalAmount, splitRows) => {
    const totalCents = Math.round(Number(totalAmount || 0) * 100);
    const splitCents = (splitRows || []).reduce((sum, row) => {
        return sum + Math.round(Number(row.amount || 0) * 100);
    }, 0);
    if (totalCents !== splitCents) {
        return { error: 'Split totals must match the expense amount.' };
    }
    return { ok: true };
};

const validateSplitTargets = (groupId, splitType, targetIds) => {
    const available = splitType === 'participants'
        ? listParticipantIds.all(groupId).map((row) => row.id)
        : listFamilyIds.all(groupId).map((row) => row.id);
    const availableSet = new Set(available);
    return targetIds.every((id) => availableSet.has(id));
};

const buildModuleExpenseDefaults = (type, payload) => {
    if (type === 'flight') {
        return {
            description: `Flight: ${payload.from} -> ${payload.to}`,
            amount: payload.cost,
            currency: payload.currency,
            date: payload.departAt,
            category: 'Flight'
        };
    }
    if (type === 'lodging') {
        return {
            description: `Lodging: ${payload.name}`,
            amount: payload.cost,
            currency: payload.currency,
            date: payload.checkIn,
            category: 'Lodging'
        };
    }
    if (type === 'transport') {
        return {
            description: `Transport: ${payload.type}`,
            amount: payload.amount,
            currency: payload.currency,
            date: payload.departAt,
            category: 'Transport'
        };
    }
    return {
        description: `Ticket: ${payload.type}`,
        amount: payload.amount,
        currency: payload.currency,
        date: payload.eventAt,
        category: 'Ticket'
    };
};

const normalizeModuleExpensePayload = (payload, defaults) => {
    if (!payload || typeof payload !== 'object') {
        return { value: null };
    }
    const merged = { ...defaults, ...payload };
    return validateExpenseSplitPayload(merged);
};

const upsertModuleExpense = (groupId, expenseId, normalized) => {
    if (!getParticipant.get(normalized.payerParticipantId, groupId)) {
        return { error: 'Payer participant not found.' };
    }
    if (!validateSplitTargets(groupId, normalized.splitType, normalized.targetIds)) {
        return { error: 'Split targets are invalid.' };
    }
    const splitRows = normalized.splitMode === 'manual'
        ? normalized.splits
        : buildEqualSplits(normalized.amount, normalized.targetIds);
    const splitCheck = validateSplitSum(normalized.amount, splitRows);
    if (splitCheck.error) {
        return { error: splitCheck.error };
    }
    const now = new Date().toISOString();
    if (expenseId) {
        updateExpense.run(
            normalized.description,
            normalized.amount,
            normalized.currency,
            normalized.date,
            normalized.category,
            normalized.payerParticipantId,
            expenseId,
            groupId
        );
    } else {
        const result = insertExpense.run(
            groupId,
            normalized.description,
            normalized.amount,
            normalized.currency,
            normalized.date,
            normalized.category,
            normalized.payerParticipantId,
            now
        );
        expenseId = result.lastInsertRowid;
    }
    saveExpenseWithSplits(expenseId, normalized.splitType, splitRows);
    return { expenseId };
};

const normalizeStoredSplitType = (value) => {
    if (value === 'participants') return 'participant';
    if (value === 'families') return 'family';
    return value;
};

const saveExpenseWithSplits = db.transaction((expenseId, splitType, splitRows) => {
    deleteExpenseSplits.run(expenseId);
    const storedSplitType = normalizeStoredSplitType(splitType);
    splitRows.forEach((row) => {
        insertExpenseSplit.run(expenseId, storedSplitType, row.targetId, row.amount);
    });
});

const toCents = (amount) => Math.round(Number(amount || 0) * 100);
const fromCents = (cents) => Number((cents / 100).toFixed(2));

const buildEqualCentsSplits = (totalCents, targetIds) => {
    const count = targetIds.length;
    const base = Math.floor(totalCents / count);
    const remainder = totalCents % count;
    return targetIds.map((targetId, index) => ({
        targetId,
        cents: base + (index < remainder ? 1 : 0)
    }));
};

const buildBalanceState = ({ participants, families, expenses, expenseSplits }) => {
    const participantById = new Map();
    const familyById = new Map();
    const participantBalances = new Map();
    const familyBalances = new Map();

    (participants || []).forEach((participant) => {
        participantById.set(participant.id, participant);
        participantBalances.set(participant.id, 0);
    });

    (families || []).forEach((family) => {
        familyById.set(family.id, family);
        familyBalances.set(family.id, 0);
    });

    const participantsByFamily = new Map();
    (participants || []).forEach((participant) => {
        if (!participant.familyId) return;
        if (!participantsByFamily.has(participant.familyId)) {
            participantsByFamily.set(participant.familyId, []);
        }
        participantsByFamily.get(participant.familyId).push(participant.id);
    });

    (expenses || []).forEach((expense) => {
        const expenseSplitsList = expenseSplits.get(expense.id) || [];
        const amountCents = toCents(expense.amount);
        if (participantBalances.has(expense.payerParticipantId)) {
            participantBalances.set(
                expense.payerParticipantId,
                participantBalances.get(expense.payerParticipantId) + amountCents
            );
        }

        expenseSplitsList.forEach((split) => {
            const splitType = normalizeStoredSplitType(split.targetType);
            const splitCents = toCents(split.amount);
            if (splitType === 'participant') {
                if (participantBalances.has(split.targetId)) {
                    participantBalances.set(
                        split.targetId,
                        participantBalances.get(split.targetId) - splitCents
                    );
                }
                return;
            }

            if (splitType === 'family') {
                if (familyBalances.has(split.targetId)) {
                    familyBalances.set(
                        split.targetId,
                        familyBalances.get(split.targetId) - splitCents
                    );
                }
                const familyParticipants = participantsByFamily.get(split.targetId) || [];
                if (!familyParticipants.length) return;
                const distributed = buildEqualCentsSplits(splitCents, familyParticipants);
                distributed.forEach((share) => {
                    participantBalances.set(
                        share.targetId,
                        participantBalances.get(share.targetId) - share.cents
                    );
                });
            }
        });
    });

    return {
        participantBalances,
        familyBalances,
        participantById,
        familyById
    };
};

const buildDebtPlan = (participantBalances) => {
    const creditors = [];
    const debtors = [];

    participantBalances.forEach((balance, participantId) => {
        if (balance > 0) {
            creditors.push({ participantId, balance });
        } else if (balance < 0) {
            debtors.push({ participantId, balance: Math.abs(balance) });
        }
    });

    creditors.sort((a, b) => b.balance - a.balance);
    debtors.sort((a, b) => b.balance - a.balance);

    const transfers = [];
    let creditorIndex = 0;
    let debtorIndex = 0;

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
        const creditor = creditors[creditorIndex];
        const debtor = debtors[debtorIndex];
        const amount = Math.min(creditor.balance, debtor.balance);

        if (amount > 0) {
            transfers.push({
                fromParticipantId: debtor.participantId,
                toParticipantId: creditor.participantId,
                amount: fromCents(amount)
            });
        }

        creditor.balance -= amount;
        debtor.balance -= amount;

        if (creditor.balance === 0) creditorIndex += 1;
        if (debtor.balance === 0) debtorIndex += 1;
    }

    return transfers;
};

app.get('/api/groups/:groupId/expenses', authRequiredApi, requireGroupMember, (req, res) => {
    const expenses = listExpenses.all(req.groupId).map((row) => {
        const splits = listExpenseSplits.all(row.id).map((split) => ({
            targetType: split.target_type,
            targetId: split.target_id,
            amount: split.amount
        }));
        return {
            id: row.id,
            description: row.description,
            amount: row.amount,
            currency: row.currency,
            date: row.date,
            category: row.category,
            payerParticipantId: row.payer_participant_id,
            splits
        };
    });
    return res.json({ ok: true, data: expenses });
});

app.post(
    '/api/groups/:groupId/expenses',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const normalized = validateExpenseSplitPayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        if (!getParticipant.get(normalized.value.payerParticipantId, req.groupId)) {
            return res.status(404).json({ error: 'Payer participant not found.' });
        }
        if (!validateSplitTargets(req.groupId, normalized.value.splitType, normalized.value.targetIds)) {
            return res.status(400).json({ error: 'Split targets are invalid.' });
        }
        const now = new Date().toISOString();
        const result = insertExpense.run(
            req.groupId,
            normalized.value.description,
            normalized.value.amount,
            normalized.value.currency,
            normalized.value.date,
            normalized.value.category,
            normalized.value.payerParticipantId,
            now
        );
        const splitRows = normalized.value.splitMode === 'manual'
            ? normalized.value.splits
            : buildEqualSplits(normalized.value.amount, normalized.value.targetIds);
        const splitCheck = validateSplitSum(normalized.value.amount, splitRows);
        if (splitCheck.error) {
            return res.status(400).json({ error: splitCheck.error });
        }
        saveExpenseWithSplits(result.lastInsertRowid, normalized.value.splitType, splitRows);
        return res.json({ ok: true, expenseId: result.lastInsertRowid });
    }
);

app.put(
    '/api/groups/:groupId/expenses/:expenseId',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const expenseId = parseGroupId(req.params.expenseId);
        if (!expenseId) {
            return res.status(400).json({ error: 'Invalid expense id.' });
        }
        if (!getExpense.get(expenseId, req.groupId)) {
            return res.status(404).json({ error: 'Expense not found.' });
        }
        const normalized = validateExpenseSplitPayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        if (!getParticipant.get(normalized.value.payerParticipantId, req.groupId)) {
            return res.status(404).json({ error: 'Payer participant not found.' });
        }
        if (!validateSplitTargets(req.groupId, normalized.value.splitType, normalized.value.targetIds)) {
            return res.status(400).json({ error: 'Split targets are invalid.' });
        }
        updateExpense.run(
            normalized.value.description,
            normalized.value.amount,
            normalized.value.currency,
            normalized.value.date,
            normalized.value.category,
            normalized.value.payerParticipantId,
            expenseId,
            req.groupId
        );
        const splitRows = normalized.value.splitMode === 'manual'
            ? normalized.value.splits
            : buildEqualSplits(normalized.value.amount, normalized.value.targetIds);
        const splitCheck = validateSplitSum(normalized.value.amount, splitRows);
        if (splitCheck.error) {
            return res.status(400).json({ error: splitCheck.error });
        }
        saveExpenseWithSplits(expenseId, normalized.value.splitType, splitRows);
        return res.json({ ok: true });
    }
);

app.delete(
    '/api/groups/:groupId/expenses/:expenseId',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const expenseId = parseGroupId(req.params.expenseId);
        if (!expenseId) {
            return res.status(400).json({ error: 'Invalid expense id.' });
        }
        if (!getExpense.get(expenseId, req.groupId)) {
            return res.status(404).json({ error: 'Expense not found.' });
        }
        deleteExpense.run(expenseId, req.groupId);
        return res.json({ ok: true });
    }
);

app.get('/api/airlines', authRequiredApi, (req, res) => {
    const airlines = listAirlines.all();
    return res.json({ ok: true, data: airlines });
});

app.get('/api/lodging-platforms', authRequiredApi, (req, res) => {
    const platforms = listLodgingPlatforms.all();
    return res.json({ ok: true, data: platforms });
});

app.get('/api/airports', authRequiredApi, (req, res) => {
    const queryRaw = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    if (!queryRaw) {
        return res.json({ ok: true, data: [] });
    }
    const query = queryRaw.toUpperCase();
    const normalized = queryRaw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
    const like = `%${query}%`;
    const likeNormalized = `%${normalized}%`;
    const airports = listAirportsByQuery.all(like, likeNormalized, likeNormalized, like, like);
    return res.json({ ok: true, data: airports });
});

app.get('/api/routes/airlines', authRequiredApi, (req, res) => {
    const from = (typeof req.query.from === 'string' ? req.query.from : '').trim();
    const to = (typeof req.query.to === 'string' ? req.query.to : '').trim();
    if (!from || !to) {
        return res.json({ ok: true, data: [] });
    }
    const fromCodes = queryAirportCodes(from);
    const toCodes = queryAirportCodes(to);
    if (!fromCodes.length || !toCodes.length) {
        return res.json({ ok: true, data: [] });
    }
    const airlines = fetchRouteAirlines(fromCodes, toCodes);
    return res.json({ ok: true, data: airlines });
});

app.get('/api/groups/:groupId/flights', authRequiredApi, requireGroupMember, (req, res) => {
    const participants = listGroupFlightParticipants.all(req.groupId);
    const participantMap = new Map();
    const seatMap = new Map();
    const baggageMap = new Map();
    participants.forEach((row) => {
        const list = participantMap.get(row.flight_id) || [];
        list.push(row.participant_id);
        participantMap.set(row.flight_id, list);
        const seats = seatMap.get(row.flight_id) || {};
        if (row.seat) {
            seats[row.participant_id] = row.seat;
        }
        seatMap.set(row.flight_id, seats);
        const baggage = baggageMap.get(row.flight_id) || {};
        if (row.baggage) {
            baggage[row.participant_id] = row.baggage;
        }
        baggageMap.set(row.flight_id, baggage);
    });
    const flights = listGroupFlights.all(req.groupId).map((row) =>
        mapGroupFlightRow(row, participantMap, seatMap, baggageMap)
    );
    return res.json({ ok: true, data: flights });
});

app.post(
    '/api/groups/:groupId/flights',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const normalized = validateGroupFlightPayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        const normalizedParticipants = normalizeParticipantIds(req.body?.participantIds);
        const participantIds = normalizedParticipants.value;
        const seatMap = normalizeParticipantSeats(req.body?.participantSeats).value;
        const baggageMap = normalizeParticipantBaggage(req.body?.participantBaggage).value;
        if (participantIds.length) {
            const allowedIds = new Set(listParticipantIds.all(req.groupId).map((row) => row.id));
            if (participantIds.some((id) => !allowedIds.has(id))) {
                return res.status(400).json({ error: 'Invalid participants.' });
            }
        }
        if ([...seatMap.keys()].some((id) => !participantIds.includes(id))) {
            return res.status(400).json({ error: 'Invalid participant seats.' });
        }
        if ([...baggageMap.keys()].some((id) => !participantIds.includes(id))) {
            return res.status(400).json({ error: 'Invalid participant baggage.' });
        }
        const expenseNormalized = normalizeModuleExpensePayload(
            req.body?.expense,
            buildModuleExpenseDefaults('flight', normalized.value)
        );
        if (expenseNormalized.error) {
            return res.status(400).json({ error: expenseNormalized.error });
        }
        const id = req.body?.id || generateTripItemId();
        try {
            const expenseId = db.transaction(() => {
                let linkedExpenseId = null;
                const platformName = normalized.value.platform || null;
                const platformId = platformName
                    ? ensureLodgingPlatformId(platformName, normalized.value.platformId)
                    : null;
                if (expenseNormalized.value) {
                    const expenseResult = upsertModuleExpense(req.groupId, null, expenseNormalized.value);
                    if (expenseResult.error) {
                        throw new Error(expenseResult.error);
                    }
                    linkedExpenseId = expenseResult.expenseId;
                }
                const airlineId = ensureAirlineId(normalized.value.airline, normalized.value.airlineId);
                const fromValue = resolveAirportCode(normalized.value.fromAirportId, normalized.value.from);
                const toValue = resolveAirportCode(normalized.value.toAirportId, normalized.value.to);
                insertGroupFlight.run(
                    id,
                    req.groupId,
                    linkedExpenseId,
                    normalized.value.airline,
                    airlineId,
                    normalized.value.flightNumber,
                    normalized.value.pnr,
                    normalized.value.cabinClass,
                    normalized.value.status,
                    normalized.value.cost,
                    normalized.value.currency,
                    fromValue,
                    toValue,
                    normalized.value.fromAirportId,
                    normalized.value.toAirportId,
                    normalized.value.departAt,
                    normalized.value.arriveAt,
                    normalized.value.notes
                );
                if (participantIds.length) {
                    const now = new Date().toISOString();
                    participantIds.forEach((participantId) => {
                        const seat = seatMap.get(participantId) || null;
                        const baggage = baggageMap.get(participantId) || null;
                        insertGroupFlightParticipant.run(req.groupId, id, participantId, seat, baggage, now);
                    });
                }
                return linkedExpenseId;
            })();
            return res.json({ ok: true, id, expenseId });
        } catch (err) {
            return res.status(400).json({ error: err.message || 'Could not save flight.' });
        }
    }
);

app.put(
    '/api/groups/:groupId/flights/:flightId',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const flightId = typeof req.params.flightId === 'string' ? req.params.flightId.trim() : '';
        if (!flightId) {
            return res.status(400).json({ error: 'Invalid flight id.' });
        }
        const existing = getGroupFlight.get(flightId, req.groupId);
        if (!existing) {
            return res.status(404).json({ error: 'Flight not found.' });
        }
        const normalized = validateGroupFlightPayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        const normalizedParticipants = normalizeParticipantIds(req.body?.participantIds);
        const participantIds = normalizedParticipants.value;
        const seatMap = normalizeParticipantSeats(req.body?.participantSeats).value;
        const baggageMap = normalizeParticipantBaggage(req.body?.participantBaggage).value;
        if (participantIds.length) {
            const allowedIds = new Set(listParticipantIds.all(req.groupId).map((row) => row.id));
            if (participantIds.some((id) => !allowedIds.has(id))) {
                return res.status(400).json({ error: 'Invalid participants.' });
            }
        }
        if ([...seatMap.keys()].some((id) => !participantIds.includes(id))) {
            return res.status(400).json({ error: 'Invalid participant seats.' });
        }
        if ([...baggageMap.keys()].some((id) => !participantIds.includes(id))) {
            return res.status(400).json({ error: 'Invalid participant baggage.' });
        }
        const expenseNormalized = normalizeModuleExpensePayload(
            req.body?.expense,
            buildModuleExpenseDefaults('flight', normalized.value)
        );
        if (expenseNormalized.error) {
            return res.status(400).json({ error: expenseNormalized.error });
        }
        try {
            const expenseId = db.transaction(() => {
                let linkedExpenseId = existing.expense_id || null;
                if (linkedExpenseId && !getExpense.get(linkedExpenseId, req.groupId)) {
                    linkedExpenseId = null;
                }
                if (expenseNormalized.value) {
                    const expenseResult = upsertModuleExpense(req.groupId, linkedExpenseId, expenseNormalized.value);
                    if (expenseResult.error) {
                        throw new Error(expenseResult.error);
                    }
                    linkedExpenseId = expenseResult.expenseId;
                }
                const airlineId = ensureAirlineId(normalized.value.airline, normalized.value.airlineId);
                const fromValue = resolveAirportCode(normalized.value.fromAirportId, normalized.value.from);
                const toValue = resolveAirportCode(normalized.value.toAirportId, normalized.value.to);
                updateGroupFlight.run(
                    linkedExpenseId,
                    normalized.value.airline,
                    airlineId,
                    normalized.value.flightNumber,
                    normalized.value.pnr,
                    normalized.value.cabinClass,
                    normalized.value.status,
                    normalized.value.cost,
                    normalized.value.currency,
                    fromValue,
                    toValue,
                    normalized.value.fromAirportId,
                    normalized.value.toAirportId,
                    normalized.value.departAt,
                    normalized.value.arriveAt,
                    normalized.value.notes,
                    flightId,
                    req.groupId
                );
                deleteGroupFlightParticipants.run(flightId, req.groupId);
                if (participantIds.length) {
                    const now = new Date().toISOString();
                    participantIds.forEach((participantId) => {
                        const seat = seatMap.get(participantId) || null;
                        const baggage = baggageMap.get(participantId) || null;
                        insertGroupFlightParticipant.run(req.groupId, flightId, participantId, seat, baggage, now);
                    });
                }
                return linkedExpenseId;
            })();
            return res.json({ ok: true, expenseId });
        } catch (err) {
            return res.status(400).json({ error: err.message || 'Could not update flight.' });
        }
    }
);

app.delete(
    '/api/groups/:groupId/flights/:flightId',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const flightId = typeof req.params.flightId === 'string' ? req.params.flightId.trim() : '';
        if (!flightId) {
            return res.status(400).json({ error: 'Invalid flight id.' });
        }
        const existing = getGroupFlight.get(flightId, req.groupId);
        if (!existing) {
            return res.status(404).json({ error: 'Flight not found.' });
        }
        try {
            db.transaction(() => {
                deleteGroupFlightParticipants.run(flightId, req.groupId);
                deleteGroupFlight.run(flightId, req.groupId);
                if (existing.expense_id) {
                    deleteExpenseSplits.run(existing.expense_id);
                    deleteExpense.run(existing.expense_id, req.groupId);
                }
            })();
            return res.json({ ok: true });
        } catch (err) {
            return res.status(400).json({ error: err.message || 'Could not delete flight.' });
        }
    }
);

app.get('/api/groups/:groupId/lodgings', authRequiredApi, requireGroupMember, (req, res) => {
    const lodgings = listGroupLodgings.all(req.groupId).map(mapGroupLodgingRow);
    return res.json({ ok: true, data: lodgings });
});

app.get('/api/groups/:groupId/lodging-properties', authRequiredApi, requireGroupMember, (req, res) => {
    const rawLimit = typeof req.query.limit === 'string' ? req.query.limit.trim() : '';
    let limit = Number.parseInt(rawLimit, 10);
    if (!Number.isFinite(limit)) {
        limit = 10;
    }
    limit = Math.max(1, Math.min(limit, 25));
    const rows = listGroupLodgingProperties.all(req.groupId, limit);
    const properties = rows.map((row) => ({
        name: row.name,
        usageCount: row.usage_count
    }));
    const seen = new Set(properties.map((item) => String(item.name).toLowerCase()));
    if (properties.length < limit) {
        for (const fallbackName of defaultLodgingProperties) {
            const key = fallbackName.toLowerCase();
            if (seen.has(key)) continue;
            properties.push({ name: fallbackName, usageCount: 0 });
            seen.add(key);
            if (properties.length >= limit) break;
        }
    }
    return res.json({ ok: true, data: properties });
});

app.get('/api/groups/:groupId/lodging-locations', authRequiredApi, requireGroupMember, (req, res) => {
    const country = typeof req.query.country === 'string' ? req.query.country.trim() : '';
    if (!country) {
        return res.status(400).json({ error: 'Country is required.' });
    }
    const rawLimit = typeof req.query.limit === 'string' ? req.query.limit.trim() : '';
    let limit = Number.parseInt(rawLimit, 10);
    if (!Number.isFinite(limit)) {
        limit = 10;
    }
    limit = Math.max(1, Math.min(limit, 25));
    const cities = listGroupLodgingCities.all(req.groupId, country, limit).map((row) => ({
        name: row.name,
        usageCount: row.usage_count
    }));
    const states = listGroupLodgingStates.all(req.groupId, country, limit).map((row) => ({
        name: row.name,
        usageCount: row.usage_count
    }));
    return res.json({ ok: true, data: { cities, states } });
});

app.post(
    '/api/groups/:groupId/lodgings',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const normalized = validateGroupLodgingPayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        const expenseNormalized = normalizeModuleExpensePayload(
            req.body?.expense,
            buildModuleExpenseDefaults('lodging', normalized.value)
        );
        if (expenseNormalized.error) {
            return res.status(400).json({ error: expenseNormalized.error });
        }
        const id = req.body?.id || generateTripItemId();
        try {
            const expenseId = db.transaction(() => {
                let linkedExpenseId = null;
                if (expenseNormalized.value) {
                    const expenseResult = upsertModuleExpense(req.groupId, null, expenseNormalized.value);
                    if (expenseResult.error) {
                        throw new Error(expenseResult.error);
                    }
                    linkedExpenseId = expenseResult.expenseId;
                }
                insertGroupLodging.run(
                    id,
                    req.groupId,
                    linkedExpenseId,
                    normalized.value.name,
                    platformName,
                    platformId,
                    normalized.value.address,
                    normalized.value.addressLine2,
                    normalized.value.city,
                    normalized.value.state,
                    normalized.value.postalCode,
                    normalized.value.country,
                    normalized.value.checkIn,
                    normalized.value.checkInTime,
                    normalized.value.checkOut,
                    normalized.value.checkOutTime,
                    normalized.value.roomType,
                    normalized.value.roomQuantity,
                    normalized.value.roomOccupancy,
                    normalized.value.status,
                    normalized.value.cost,
                    normalized.value.currency,
                    normalized.value.host,
                    normalized.value.contact,
                    normalized.value.contactPhone,
                    normalized.value.contactEmail,
                    normalized.value.notes
                );
                return linkedExpenseId;
            })();
            return res.json({ ok: true, id, expenseId });
        } catch (err) {
            return res.status(400).json({ error: err.message || 'Could not save lodging.' });
        }
    }
);

app.put(
    '/api/groups/:groupId/lodgings/:lodgingId',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const lodgingId = typeof req.params.lodgingId === 'string' ? req.params.lodgingId.trim() : '';
        if (!lodgingId) {
            return res.status(400).json({ error: 'Invalid lodging id.' });
        }
        const existing = getGroupLodging.get(lodgingId, req.groupId);
        if (!existing) {
            return res.status(404).json({ error: 'Lodging not found.' });
        }
        const normalized = validateGroupLodgingPayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        const expenseNormalized = normalizeModuleExpensePayload(
            req.body?.expense,
            buildModuleExpenseDefaults('lodging', normalized.value)
        );
        if (expenseNormalized.error) {
            return res.status(400).json({ error: expenseNormalized.error });
        }
        try {
            const expenseId = db.transaction(() => {
                let linkedExpenseId = existing.expense_id || null;
                const platformName = normalized.value.platform || null;
                const platformId = platformName
                    ? ensureLodgingPlatformId(platformName, normalized.value.platformId)
                    : null;
                if (linkedExpenseId && !getExpense.get(linkedExpenseId, req.groupId)) {
                    linkedExpenseId = null;
                }
                if (expenseNormalized.value) {
                    const expenseResult = upsertModuleExpense(req.groupId, linkedExpenseId, expenseNormalized.value);
                    if (expenseResult.error) {
                        throw new Error(expenseResult.error);
                    }
                    linkedExpenseId = expenseResult.expenseId;
                }
                updateGroupLodging.run(
                    linkedExpenseId,
                    normalized.value.name,
                    platformName,
                    platformId,
                    normalized.value.address,
                    normalized.value.addressLine2,
                    normalized.value.city,
                    normalized.value.state,
                    normalized.value.postalCode,
                    normalized.value.country,
                    normalized.value.checkIn,
                    normalized.value.checkInTime,
                    normalized.value.checkOut,
                    normalized.value.checkOutTime,
                    normalized.value.roomType,
                    normalized.value.roomQuantity,
                    normalized.value.roomOccupancy,
                    normalized.value.status,
                    normalized.value.cost,
                    normalized.value.currency,
                    normalized.value.host,
                    normalized.value.contact,
                    normalized.value.contactPhone,
                    normalized.value.contactEmail,
                    normalized.value.notes,
                    lodgingId,
                    req.groupId
                );
                return linkedExpenseId;
            })();
            return res.json({ ok: true, expenseId });
        } catch (err) {
            return res.status(400).json({ error: err.message || 'Could not update lodging.' });
        }
    }
);

app.delete(
    '/api/groups/:groupId/lodgings/:lodgingId',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const lodgingId = typeof req.params.lodgingId === 'string' ? req.params.lodgingId.trim() : '';
        if (!lodgingId) {
            return res.status(400).json({ error: 'Invalid lodging id.' });
        }
        const existing = getGroupLodging.get(lodgingId, req.groupId);
        if (!existing) {
            return res.status(404).json({ error: 'Lodging not found.' });
        }
        try {
            db.transaction(() => {
                deleteGroupLodging.run(lodgingId, req.groupId);
                if (existing.expense_id) {
                    deleteExpenseSplits.run(existing.expense_id);
                    deleteExpense.run(existing.expense_id, req.groupId);
                }
            })();
            return res.json({ ok: true });
        } catch (err) {
            return res.status(400).json({ error: err.message || 'Could not delete lodging.' });
        }
    }
);

app.get('/api/groups/:groupId/transports', authRequiredApi, requireGroupMember, (req, res) => {
    const transports = listGroupTransports.all(req.groupId).map(mapGroupTransportRow);
    return res.json({ ok: true, data: transports });
});

app.post(
    '/api/groups/:groupId/transports',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const normalized = validateGroupTransportPayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        const expenseNormalized = normalizeModuleExpensePayload(
            req.body?.expense,
            buildModuleExpenseDefaults('transport', normalized.value)
        );
        if (expenseNormalized.error) {
            return res.status(400).json({ error: expenseNormalized.error });
        }
        const id = req.body?.id || generateTripItemId();
        try {
            const expenseId = db.transaction(() => {
                let linkedExpenseId = null;
                if (expenseNormalized.value) {
                    const expenseResult = upsertModuleExpense(req.groupId, null, expenseNormalized.value);
                    if (expenseResult.error) {
                        throw new Error(expenseResult.error);
                    }
                    linkedExpenseId = expenseResult.expenseId;
                }
                insertGroupTransport.run(
                    id,
                    req.groupId,
                    linkedExpenseId,
                    normalized.value.type,
                    normalized.value.origin,
                    normalized.value.destination,
                    normalized.value.departAt,
                    normalized.value.arriveAt,
                    normalized.value.provider,
                    normalized.value.locator,
                    normalized.value.status,
                    normalized.value.amount,
                    normalized.value.currency,
                    normalized.value.notes
                );
                return linkedExpenseId;
            })();
            return res.json({ ok: true, id, expenseId });
        } catch (err) {
            return res.status(400).json({ error: err.message || 'Could not save transport.' });
        }
    }
);

app.put(
    '/api/groups/:groupId/transports/:transportId',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const transportId = typeof req.params.transportId === 'string' ? req.params.transportId.trim() : '';
        if (!transportId) {
            return res.status(400).json({ error: 'Invalid transport id.' });
        }
        const existing = getGroupTransport.get(transportId, req.groupId);
        if (!existing) {
            return res.status(404).json({ error: 'Transport not found.' });
        }
        const normalized = validateGroupTransportPayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        const expenseNormalized = normalizeModuleExpensePayload(
            req.body?.expense,
            buildModuleExpenseDefaults('transport', normalized.value)
        );
        if (expenseNormalized.error) {
            return res.status(400).json({ error: expenseNormalized.error });
        }
        try {
            const expenseId = db.transaction(() => {
                let linkedExpenseId = existing.expense_id || null;
                if (linkedExpenseId && !getExpense.get(linkedExpenseId, req.groupId)) {
                    linkedExpenseId = null;
                }
                if (expenseNormalized.value) {
                    const expenseResult = upsertModuleExpense(req.groupId, linkedExpenseId, expenseNormalized.value);
                    if (expenseResult.error) {
                        throw new Error(expenseResult.error);
                    }
                    linkedExpenseId = expenseResult.expenseId;
                }
                updateGroupTransport.run(
                    linkedExpenseId,
                    normalized.value.type,
                    normalized.value.origin,
                    normalized.value.destination,
                    normalized.value.departAt,
                    normalized.value.arriveAt,
                    normalized.value.provider,
                    normalized.value.locator,
                    normalized.value.status,
                    normalized.value.amount,
                    normalized.value.currency,
                    normalized.value.notes,
                    transportId,
                    req.groupId
                );
                return linkedExpenseId;
            })();
            return res.json({ ok: true, expenseId });
        } catch (err) {
            return res.status(400).json({ error: err.message || 'Could not update transport.' });
        }
    }
);

app.delete(
    '/api/groups/:groupId/transports/:transportId',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const transportId = typeof req.params.transportId === 'string' ? req.params.transportId.trim() : '';
        if (!transportId) {
            return res.status(400).json({ error: 'Invalid transport id.' });
        }
        const existing = getGroupTransport.get(transportId, req.groupId);
        if (!existing) {
            return res.status(404).json({ error: 'Transport not found.' });
        }
        try {
            db.transaction(() => {
                deleteGroupTransport.run(transportId, req.groupId);
                if (existing.expense_id) {
                    deleteExpenseSplits.run(existing.expense_id);
                    deleteExpense.run(existing.expense_id, req.groupId);
                }
            })();
            return res.json({ ok: true });
        } catch (err) {
            return res.status(400).json({ error: err.message || 'Could not delete transport.' });
        }
    }
);

app.get('/api/groups/:groupId/tickets', authRequiredApi, requireGroupMember, (req, res) => {
    const participants = listGroupTicketParticipants.all(req.groupId);
    const participantMap = new Map();
    participants.forEach((row) => {
        const list = participantMap.get(row.ticket_id) || [];
        list.push(row.participant_id);
        participantMap.set(row.ticket_id, list);
    });
    const tickets = listGroupTickets.all(req.groupId).map((row) => mapGroupTicketRow(row, participantMap));
    return res.json({ ok: true, data: tickets });
});

app.post(
    '/api/groups/:groupId/tickets',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const normalized = validateGroupTicketPayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        const normalizedParticipants = normalizeParticipantIds(req.body?.participantIds);
        const participantIds = normalizedParticipants.value;
        if (participantIds.length) {
            const allowedIds = new Set(listParticipantIds.all(req.groupId).map((row) => row.id));
            if (participantIds.some((id) => !allowedIds.has(id))) {
                return res.status(400).json({ error: 'Invalid participants.' });
            }
        }
        const expenseNormalized = normalizeModuleExpensePayload(
            req.body?.expense,
            buildModuleExpenseDefaults('ticket', normalized.value)
        );
        if (expenseNormalized.error) {
            return res.status(400).json({ error: expenseNormalized.error });
        }
        const id = req.body?.id || generateTripItemId();
        try {
            const expenseId = db.transaction(() => {
                let linkedExpenseId = null;
                if (expenseNormalized.value) {
                    const expenseResult = upsertModuleExpense(req.groupId, null, expenseNormalized.value);
                    if (expenseResult.error) {
                        throw new Error(expenseResult.error);
                    }
                    linkedExpenseId = expenseResult.expenseId;
                }
                insertGroupTicket.run(
                    id,
                    req.groupId,
                    linkedExpenseId,
                    normalized.value.type,
                    normalized.value.eventAt,
                    normalized.value.location,
                    normalized.value.status,
                    normalized.value.type,
                    normalized.value.eventAt,
                    normalized.value.amount,
                    normalized.value.currency,
                    null,
                    normalized.value.notes
                );
                if (participantIds.length) {
                    const now = new Date().toISOString();
                    participantIds.forEach((participantId) => {
                        insertGroupTicketParticipant.run(req.groupId, id, participantId, now);
                    });
                }
                return linkedExpenseId;
            })();
            return res.json({ ok: true, id, expenseId });
        } catch (err) {
            return res.status(400).json({ error: err.message || 'Could not save ticket.' });
        }
    }
);

app.put(
    '/api/groups/:groupId/tickets/:ticketId',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const ticketId = typeof req.params.ticketId === 'string' ? req.params.ticketId.trim() : '';
        if (!ticketId) {
            return res.status(400).json({ error: 'Invalid ticket id.' });
        }
        const existing = getGroupTicket.get(ticketId, req.groupId);
        if (!existing) {
            return res.status(404).json({ error: 'Ticket not found.' });
        }
        const normalized = validateGroupTicketPayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        const normalizedParticipants = normalizeParticipantIds(req.body?.participantIds);
        const participantIds = normalizedParticipants.value;
        if (participantIds.length) {
            const allowedIds = new Set(listParticipantIds.all(req.groupId).map((row) => row.id));
            if (participantIds.some((id) => !allowedIds.has(id))) {
                return res.status(400).json({ error: 'Invalid participants.' });
            }
        }
        const expenseNormalized = normalizeModuleExpensePayload(
            req.body?.expense,
            buildModuleExpenseDefaults('ticket', normalized.value)
        );
        if (expenseNormalized.error) {
            return res.status(400).json({ error: expenseNormalized.error });
        }
        try {
            const expenseId = db.transaction(() => {
                let linkedExpenseId = existing.expense_id || null;
                if (linkedExpenseId && !getExpense.get(linkedExpenseId, req.groupId)) {
                    linkedExpenseId = null;
                }
                if (expenseNormalized.value) {
                    const expenseResult = upsertModuleExpense(req.groupId, linkedExpenseId, expenseNormalized.value);
                    if (expenseResult.error) {
                        throw new Error(expenseResult.error);
                    }
                    linkedExpenseId = expenseResult.expenseId;
                }
                updateGroupTicket.run(
                    linkedExpenseId,
                    normalized.value.type,
                    normalized.value.eventAt,
                    normalized.value.location,
                    normalized.value.status,
                    normalized.value.type,
                    normalized.value.eventAt,
                    normalized.value.amount,
                    normalized.value.currency,
                    null,
                    normalized.value.notes,
                    ticketId,
                    req.groupId
                );
                deleteGroupTicketParticipants.run(ticketId, req.groupId);
                if (participantIds.length) {
                    const now = new Date().toISOString();
                    participantIds.forEach((participantId) => {
                        insertGroupTicketParticipant.run(req.groupId, ticketId, participantId, now);
                    });
                }
                return linkedExpenseId;
            })();
            return res.json({ ok: true, expenseId });
        } catch (err) {
            return res.status(400).json({ error: err.message || 'Could not update ticket.' });
        }
    }
);

app.delete(
    '/api/groups/:groupId/tickets/:ticketId',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const ticketId = typeof req.params.ticketId === 'string' ? req.params.ticketId.trim() : '';
        if (!ticketId) {
            return res.status(400).json({ error: 'Invalid ticket id.' });
        }
        const existing = getGroupTicket.get(ticketId, req.groupId);
        if (!existing) {
            return res.status(404).json({ error: 'Ticket not found.' });
        }
        try {
            db.transaction(() => {
                deleteGroupTicketParticipants.run(ticketId, req.groupId);
                deleteGroupTicket.run(ticketId, req.groupId);
                if (existing.expense_id) {
                    deleteExpenseSplits.run(existing.expense_id);
                    deleteExpense.run(existing.expense_id, req.groupId);
                }
            })();
            return res.json({ ok: true });
        } catch (err) {
            return res.status(400).json({ error: err.message || 'Could not delete ticket.' });
        }
    }
);

app.get('/api/groups/:groupId/summary', authRequiredApi, requireGroupMember, (req, res) => {
    const participants = listParticipants.all(req.groupId).map((row) => ({
        id: row.id,
        familyId: row.family_id,
        displayName: row.display_name
    }));
    const families = listFamilies.all(req.groupId).map((row) => ({
        id: row.id,
        name: row.name
    }));
    const expenses = listExpenses.all(req.groupId).map((row) => ({
        id: row.id,
        amount: row.amount,
        payerParticipantId: row.payer_participant_id
    }));
    const expenseSplits = new Map();
    expenses.forEach((expense) => {
        const splits = listExpenseSplits.all(expense.id).map((split) => ({
            targetType: split.target_type,
            targetId: split.target_id,
            amount: split.amount
        }));
        expenseSplits.set(expense.id, splits);
    });

    const state = buildBalanceState({ participants, families, expenses, expenseSplits });
    const participantBalances = participants.map((participant) => ({
        participantId: participant.id,
        displayName: participant.displayName,
        familyId: participant.familyId,
        balance: fromCents(state.participantBalances.get(participant.id) || 0)
    }));
    const familyBalances = families.map((family) => ({
        familyId: family.id,
        name: family.name,
        balance: fromCents(state.familyBalances.get(family.id) || 0)
    }));
    const debts = buildDebtPlan(state.participantBalances);

    return res.json({
        ok: true,
        data: {
            participantBalances,
            familyBalances,
            debts
        }
    });
});

app.post(
    '/api/groups/:groupId/invitations',
    authRequiredApi,
    requireCsrfToken,
    requireGroupMember,
    requireGroupRole(['owner', 'admin']),
    (req, res) => {
        const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
        if (!emailRaw || !isValidEmail(emailRaw)) {
            return res.status(400).json({ error: 'Valid email is required.' });
        }
        const role = normalizeGroupRole(req.body?.role) || 'member';
        if (!INVITABLE_ROLES.includes(role)) {
            return res.status(400).json({ error: 'Invalid role for invitation.' });
        }
        const token = crypto.randomBytes(24).toString('hex');
        const expiresAt = Date.now() + INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
        const now = new Date().toISOString();
        insertInvitation.run(
            req.groupId,
            emailRaw.toLowerCase(),
            role,
            token,
            expiresAt,
            'pending',
            req.user.sub,
            now
        );
        const baseUrl = APP_BASE_URL || `http://localhost:${PORT}`;
        const inviteUrl = `${baseUrl}/invite?token=${token}`;
        return res.json({ ok: true, token, inviteUrl, expiresAt });
    }
);

app.post('/api/invitations/accept', authRequiredApi, requireCsrfToken, (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
        return res.status(400).json({ error: 'Invitation token is required.' });
    }
    const invitation = getInvitationByToken.get(token);
    if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found.' });
    }
    if (invitation.status !== 'pending') {
        return res.status(400).json({ error: 'Invitation is no longer available.' });
    }
    if (Date.now() > invitation.expires_at) {
        markInvitationExpired.run('expired', invitation.id);
        return res.status(400).json({ error: 'Invitation has expired.' });
    }
    const userRecord = getUserEmail.get(req.user.sub);
    if (!userRecord || !userRecord.email) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (userRecord.email.toLowerCase() !== invitation.email.toLowerCase()) {
        return res.status(403).json({ error: 'Invitation email does not match your account.' });
    }
    const now = new Date().toISOString();
    insertGroupMemberIfMissing.run(invitation.group_id, req.user.sub, invitation.role, now);
    updateInvitationStatus.run('accepted', req.user.sub, invitation.id);
    return res.json({ ok: true, groupId: invitation.group_id });
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

const mapGroupFlightRow = (row, participantMap, seatMap, baggageMap) => ({
    id: row.id,
    expenseId: row.expense_id || null,
    airline: row.airline,
    airlineId: row.airline_id || null,
    flightNumber: row.flight_number,
    pnr: row.pnr,
    cabinClass: row.cabin_class,
    status: row.status || 'planned',
    cost: row.cost,
    currency: row.currency,
    from: row.from_city,
    to: row.to_city,
    fromLabel: resolveAirportLabel(row.from_airport_id, row.from_city),
    toLabel: resolveAirportLabel(row.to_airport_id, row.to_city),
    fromAirportId: row.from_airport_id || null,
    toAirportId: row.to_airport_id || null,
    departAt: row.depart_at,
    arriveAt: row.arrive_at,
    notes: row.notes,
    participantIds: participantMap?.get(row.id) || [],
    participantSeats: seatMap?.get(row.id) || {},
    participantBaggage: baggageMap?.get(row.id) || {}
});

const mapGroupLodgingRow = (row) => ({
    id: row.id,
    expenseId: row.expense_id || null,
    name: row.name,
    platform: row.platform,
    platformId: row.platform_id || null,
    address: row.address,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    checkIn: row.check_in,
    checkInTime: row.check_in_time,
    checkOut: row.check_out,
    checkOutTime: row.check_out_time,
    roomType: row.room_type,
    roomQuantity: row.room_quantity,
    roomOccupancy: row.room_occupancy,
    status: row.status || 'planned',
    cost: row.cost,
    currency: row.currency,
    host: row.host,
    contact: row.contact,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    notes: row.notes
});

const mapGroupTransportRow = (row) => ({
    id: row.id,
    expenseId: row.expense_id || null,
    type: row.type,
    origin: row.origin,
    destination: row.destination,
    departAt: row.depart_at,
    arriveAt: row.arrive_at,
    provider: row.provider,
    locator: row.locator,
    status: row.status || 'planned',
    amount: row.amount,
    currency: row.currency,
    notes: row.notes
});

const mapGroupTicketRow = (row, participantMap) => ({
    id: row.id,
    expenseId: row.expense_id || null,
    type: row.type || row.name,
    eventAt: row.event_at || row.date,
    location: row.location,
    status: row.status || 'planned',
    amount: row.amount,
    currency: row.currency,
    notes: row.notes,
    participantIds: participantMap?.get(row.id) || []
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

const normalizeGroupRole = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    return trimmed || null;
};

const validateGroupPayload = (payload) => {
    const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
    if (!name) {
        return { error: 'Group name is required.' };
    }
    if (name.length > 80) {
        return { error: 'Group name must be 80 characters or less.' };
    }
    const currencyRaw = typeof payload?.defaultCurrency === 'string'
        ? payload.defaultCurrency.trim().toUpperCase()
        : '';
    if (!/^[A-Z]{3}$/.test(currencyRaw)) {
        return { error: 'Default currency must be a 3-letter code.' };
    }
    return { value: { name, defaultCurrency: currencyRaw } };
};

const validateFamilyPayload = (payload) => {
    const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
    if (!name) {
        return { error: 'Family name is required.' };
    }
    if (name.length > 80) {
        return { error: 'Family name must be 80 characters or less.' };
    }
    return { value: { name } };
};

const validateParticipantPayload = (payload) => {
    const displayName = typeof payload?.displayName === 'string' ? payload.displayName.trim() : '';
    if (!displayName) {
        return { error: 'Participant name is required.' };
    }
    if (displayName.length > 80) {
        return { error: 'Participant name must be 80 characters or less.' };
    }
    const type = normalizeGroupRole(payload?.type);
    const allowedTypes = ['adult', 'child', 'infant'];
    if (type && !allowedTypes.includes(type)) {
        return { error: 'Participant type is invalid.' };
    }
    const familyId = payload?.familyId === null || payload?.familyId === undefined
        ? null
        : parseGroupId(payload.familyId);
    if (payload?.familyId && !familyId) {
        return { error: 'Family id is invalid.' };
    }
    return { value: { displayName, type, familyId } };
};

const normalizeSplitType = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    return trimmed || null;
};

const normalizeSplitMode = (value) => {
    if (typeof value !== 'string') return 'equal';
    const trimmed = value.trim().toLowerCase();
    return trimmed || 'equal';
};

const requireCurrencyCode = (value) => {
    const trimmed = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!/^[A-Z]{3}$/.test(trimmed)) {
        return { error: 'Currency is invalid.' };
    }
    return { value: trimmed };
};

const parseManualSplits = (items) => {
    if (!Array.isArray(items)) {
        return { error: 'Manual splits are required.' };
    }
    const rows = [];
    const seen = new Set();
    for (const item of items) {
        const targetId = parseGroupId(item?.targetId);
        if (!targetId) {
            return { error: 'Split target is invalid.' };
        }
        if (seen.has(targetId)) {
            return { error: 'Split target is duplicated.' };
        }
        const amount = Number(item?.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            return { error: 'Split amount must be greater than zero.' };
        }
        seen.add(targetId);
        rows.push({ targetId, amount });
    }
    if (!rows.length) {
        return { error: 'Split targets are required.' };
    }
    return { rows };
};

const parseIdArray = (items) => {
    if (!Array.isArray(items)) return [];
    const output = [];
    items.forEach((item) => {
        const id = parseGroupId(item);
        if (id && !output.includes(id)) {
            output.push(id);
        }
    });
    return output;
};

const validateExpenseSplitPayload = (payload) => {
    const description = typeof payload?.description === 'string' ? payload.description.trim() : '';
    if (!description) {
        return { error: 'Description is required.' };
    }
    if (description.length > 140) {
        return { error: 'Description must be 140 characters or less.' };
    }
    const amount = Number(payload?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { error: 'Amount must be greater than zero.' };
    }
    const currency = requireCurrencyCode(payload?.currency);
    if (currency.error) return currency;
    const date = requireDate(payload?.date, 'Date');
    if (date.error) return date;
    const category = optionalString(payload?.category);
    const payerParticipantId = parseGroupId(payload?.payerParticipantId);
    if (!payerParticipantId) {
        return { error: 'Payer participant is required.' };
    }
    const splitType = normalizeSplitType(payload?.splitType);
    if (!splitType || !['participants', 'families'].includes(splitType)) {
        return { error: 'Split type is invalid.' };
    }
    const splitMode = normalizeSplitMode(payload?.splitMode);
    if (!['equal', 'manual'].includes(splitMode)) {
        return { error: 'Split mode is invalid.' };
    }

    let targetIds = [];
    let manualSplits = null;
    if (splitMode === 'manual') {
        const parsed = parseManualSplits(payload?.splits);
        if (parsed.error) return { error: parsed.error };
        manualSplits = parsed.rows;
        targetIds = manualSplits.map((row) => row.targetId);
        const sumCheck = validateSplitSum(amount, manualSplits);
        if (sumCheck.error) {
            return { error: sumCheck.error };
        }
    } else {
        targetIds = splitType === 'participants'
            ? parseIdArray(payload?.participantIds)
            : parseIdArray(payload?.familyIds);
        if (!targetIds.length) {
            return { error: 'Split targets are required.' };
        }
    }
    return {
        value: {
            description,
            amount,
            currency: currency.value,
            date: date.value,
            category,
            payerParticipantId,
            splitType,
            targetIds,
            splitMode,
            splits: manualSplits
        }
    };
};

const requireNumber = (value, field) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return { error: `${field} must be a number.` };
    }
    return { value: number };
};

const requirePositiveInt = (value, field) => {
    const number = Number(value);
    if (!Number.isFinite(number) || !Number.isInteger(number) || number <= 0) {
        return { error: `${field} must be a positive integer.` };
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

const requireTime = (value, field) => {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) {
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

const normalizeParticipantIds = (value) => {
    if (!Array.isArray(value)) return { value: [] };
    const ids = value
        .map((item) => parseGroupId(item))
        .filter((item) => item !== null);
    return { value: Array.from(new Set(ids)) };
};

const normalizeParticipantSeats = (value) => {
    if (!value || typeof value !== 'object') {
        return { value: new Map() };
    }
    const seatMap = new Map();
    Object.entries(value).forEach(([id, seat]) => {
        const parsedId = parseGroupId(id);
        if (parsedId === null) return;
        seatMap.set(parsedId, optionalString(seat));
    });
    return { value: seatMap };
};

const normalizeParticipantBaggage = (value) => {
    if (!value || typeof value !== 'object') {
        return { value: new Map() };
    }
    const baggageMap = new Map();
    Object.entries(value).forEach(([id, baggage]) => {
        const parsedId = parseGroupId(id);
        if (parsedId === null) return;
        baggageMap.set(parsedId, optionalString(baggage));
    });
    return { value: baggageMap };
};

const formatAirportLabel = (airport) => {
    if (!airport) return null;
    const label = airport.city || airport.name || airport.code;
    if (airport.code && label && label !== airport.code) {
        return `${label} (${airport.code})`;
    }
    return airport.code || label || null;
};

const resolveAirportCode = (airportId, fallback) => {
    if (!airportId) return fallback;
    const airport = getAirportById.get(airportId);
    return airport ? airport.code : fallback;
};

const resolveAirportLabel = (airportId, fallback) => {
    if (!airportId) return fallback;
    const airport = getAirportById.get(airportId);
    return formatAirportLabel(airport) || fallback;
};

const optionalCabinClass = (value) => {
    if (!value) return { value: null };
    const valid = ['economy', 'premium_economy', 'business', 'first'];
    if (!valid.includes(value)) {
        return { error: 'Cabin class is invalid.' };
    }
    return { value };
};

const validateGroupFlightPayload = (payload) => {
    const airline = requireString(payload.airline, 'Airline');
    if (airline.error) return airline;
    const airlineId = parseGroupId(payload.airlineId);
    const flightNumber = requireString(payload.flightNumber, 'Flight number');
    if (flightNumber.error) return flightNumber;
    const fromCity = requireString(payload.from, 'From');
    if (fromCity.error) return fromCity;
    const toCity = requireString(payload.to, 'To');
    if (toCity.error) return toCity;
    const fromAirportId = parseGroupId(payload.fromAirportId);
    const toAirportId = parseGroupId(payload.toAirportId);
    const departAt = requireDate(payload.departAt, 'Departure');
    if (departAt.error) return departAt;
    const arriveAt = requireDate(payload.arriveAt, 'Arrival');
    if (arriveAt.error) return arriveAt;
    if (new Date(arriveAt.value).getTime() <= new Date(departAt.value).getTime()) {
        return { error: 'Arrival must be after departure.' };
    }
    const cabinClass = optionalCabinClass(payload.cabinClass);
    if (cabinClass.error) return cabinClass;
    const status = payload.status ? requireStatus(payload.status) : { value: 'planned' };
    if (status.error) return status;
    const currency = requireCurrency(payload.currency);
    if (currency.error) return currency;
    const cost = requireNumber(payload.cost, 'Cost');
    if (cost.error) return cost;
    return {
        value: {
            airline: airline.value,
            flightNumber: flightNumber.value,
            pnr: optionalString(payload.pnr),
            cabinClass: cabinClass.value,
            status: status.value,
            cost: cost.value,
            currency: currency.value,
            from: fromCity.value,
            to: toCity.value,
            fromAirportId,
            toAirportId,
            departAt: departAt.value,
            arriveAt: arriveAt.value,
            notes: optionalString(payload.notes),
            airlineId
        }
    };
};

const validateGroupLodgingPayload = (payload) => {
    const name = requireString(payload.name, 'Property');
    if (name.error) return name;
    const platform = optionalString(payload.platform);
    const platformId = parseGroupId(payload.platformId);
    const address = requireString(payload.address, 'Address');
    if (address.error) return address;
    const city = requireString(payload.city, 'City');
    if (city.error) return city;
    const country = requireString(payload.country, 'Country');
    if (country.error) return country;
    const checkIn = requireDate(payload.checkIn, 'Check-in');
    if (checkIn.error) return checkIn;
    const checkInTime = requireTime(payload.checkInTime, 'Check-in time');
    if (checkInTime.error) return checkInTime;
    const checkOut = requireDate(payload.checkOut, 'Check-out');
    if (checkOut.error) return checkOut;
    if (new Date(checkOut.value).getTime() <= new Date(checkIn.value).getTime()) {
        return { error: 'Check-out must be after check-in.' };
    }
    const checkOutTime = requireTime(payload.checkOutTime, 'Check-out time');
    if (checkOutTime.error) return checkOutTime;
    const roomType = requireString(payload.roomType, 'Room type');
    if (roomType.error) return roomType;
    const roomQuantity = requirePositiveInt(payload.roomQuantity, 'Room quantity');
    if (roomQuantity.error) return roomQuantity;
    const roomOccupancy = requirePositiveInt(payload.roomOccupancy, 'Room occupancy');
    if (roomOccupancy.error) return roomOccupancy;
    const status = payload.status ? requireStatus(payload.status) : { value: 'planned' };
    if (status.error) return status;
    const currency = requireCurrency(payload.currency);
    if (currency.error) return currency;
    const cost = requireNumber(payload.cost, 'Total cost');
    if (cost.error) return cost;
    const contact = requireString(payload.contact, 'Contact name');
    if (contact.error) return contact;
    return {
        value: {
            name: name.value,
            platform,
            platformId,
            address: address.value,
            addressLine2: optionalString(payload.addressLine2),
            city: city.value,
            state: optionalString(payload.state),
            postalCode: optionalString(payload.postalCode),
            country: country.value,
            checkIn: checkIn.value,
            checkInTime: checkInTime.value,
            checkOut: checkOut.value,
            checkOutTime: checkOutTime.value,
            roomType: roomType.value,
            roomQuantity: roomQuantity.value,
            roomOccupancy: roomOccupancy.value,
            status: status.value,
            cost: cost.value,
            currency: currency.value,
            host: optionalString(payload.host),
            contact: contact.value,
            contactPhone: optionalString(payload.contactPhone),
            contactEmail: optionalString(payload.contactEmail),
            notes: optionalString(payload.notes)
        }
    };
};

const validateGroupTransportPayload = (payload) => {
    const type = requireString(payload.type, 'Type');
    if (type.error) return type;
    const origin = requireString(payload.origin, 'Origin');
    if (origin.error) return origin;
    const destination = requireString(payload.destination, 'Destination');
    if (destination.error) return destination;
    const departAt = requireDate(payload.departAt, 'Departure');
    if (departAt.error) return departAt;
    const arriveAt = requireDate(payload.arriveAt, 'Arrival');
    if (arriveAt.error) return arriveAt;
    if (new Date(arriveAt.value).getTime() <= new Date(departAt.value).getTime()) {
        return { error: 'Arrival must be after departure.' };
    }
    const status = payload.status ? requireStatus(payload.status) : { value: 'planned' };
    if (status.error) return status;
    const currency = requireCurrency(payload.currency);
    if (currency.error) return currency;
    const amount = requireNumber(payload.amount, 'Amount');
    if (amount.error) return amount;
    return {
        value: {
            type: type.value,
            origin: origin.value,
            destination: destination.value,
            departAt: departAt.value,
            arriveAt: arriveAt.value,
            provider: optionalString(payload.provider),
            locator: optionalString(payload.locator),
            status: status.value,
            amount: amount.value,
            currency: currency.value,
            notes: optionalString(payload.notes)
        }
    };
};

const validateGroupTicketPayload = (payload) => {
    const type = requireString(payload.type, 'Ticket type');
    if (type.error) return type;
    const eventAt = requireDate(payload.eventAt, 'Date/time');
    if (eventAt.error) return eventAt;
    const location = requireString(payload.location, 'Location');
    if (location.error) return location;
    const status = payload.status ? requireStatus(payload.status) : { value: 'planned' };
    if (status.error) return status;
    if (status.value === 'planned' && new Date(eventAt.value).getTime() <= Date.now()) {
        return { error: 'Planned tickets must be scheduled in the future.' };
    }
    const currency = requireCurrency(payload.currency);
    if (currency.error) return currency;
    const amount = requireNumber(payload.amount, 'Amount');
    if (amount.error) return amount;
    return {
        value: {
            type: type.value,
            eventAt: eventAt.value,
            location: location.value,
            status: status.value,
            amount: amount.value,
            currency: currency.value,
            notes: optionalString(payload.notes)
        }
    };
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
    if (new Date(arriveAt.value).getTime() <= new Date(departAt.value).getTime()) {
        return { error: 'Arrival must be after departure.' };
    }
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
    validateGroupPayload,
    validateFamilyPayload,
    validateParticipantPayload,
    validateExpenseSplitPayload,
    validateGroupFlightPayload,
    validateGroupLodgingPayload,
    validateGroupTransportPayload,
    validateGroupTicketPayload,
    validateSplitSum,
    buildBalanceState,
    buildDebtPlan,
    validateFlightPayload,
    validateLodgingPayload,
    validateCarPayload,
    validateExpensePayload,
    validateTransportPayload,
    validateTimelinePayload,
    validateReminderPayload,
    validateTripMetaPayload
};
