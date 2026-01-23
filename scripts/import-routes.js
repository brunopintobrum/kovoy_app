#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { parse } = require('csv-parse/sync');

const DEFAULT_ROUTES = process.platform === 'win32'
    ? 'C:\\\\Users\\\\bruno\\\\Downloads\\\\routes.csv'
    : path.join(process.env.HOME || '.', 'Downloads', 'routes.csv');
const DEFAULT_AIRPORTS = process.platform === 'win32'
    ? 'C:\\\\Users\\\\bruno\\\\Downloads\\\\airports.csv'
    : path.join(process.env.HOME || '.', 'Downloads', 'airports.csv');

const routesPath = process.argv[2] || DEFAULT_ROUTES;
const airportsPath = process.argv[3] || DEFAULT_AIRPORTS;
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');

if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exit(1);
}

if (!fs.existsSync(routesPath)) {
    console.error(`Routes file not found: ${routesPath}`);
    process.exit(1);
}

if (!fs.existsSync(airportsPath)) {
    console.error(`Airports file not found: ${airportsPath}`);
    process.exit(1);
}

const db = new Database(dbPath);
const insertAirport = db.prepare('INSERT OR REPLACE INTO airports (code, name, city, country) VALUES (?, ?, ?, ?)');
const insertRoute = db.prepare('INSERT OR IGNORE INTO route_airlines (airline_name, airline_id, from_code, to_code) VALUES (?, ?, ?, ?)');
const findAirline = db.prepare('SELECT id FROM airlines WHERE LOWER(name) = ?');
const insertAirline = db.prepare('INSERT OR IGNORE INTO airlines (name) VALUES (?)');

const airportCsv = fs.readFileSync(airportsPath, 'utf8');
const airportRecords = parse(airportCsv, {
    columns: true,
    skip_empty_lines: true,
    trim: true
});

const routeCsv = fs.readFileSync(routesPath, 'utf8');
const routeRecords = parse(routeCsv, {
    columns: [
        'Airline',
        'Airline ID',
        'Source airport',
        'Source airport ID',
        'Destination airport',
        'Destination airport ID',
        'Codeshare',
        'Stops',
        'Equipment'
    ],
    skip_empty_lines: true,
    trim: true
});

const normalizeCode = (value) => {
    if (!value) return '';
    return value.trim().toUpperCase();
};

const getOrCreateAirlineId = (name) => {
    const lower = name.toLowerCase().trim();
    const existing = findAirline.get(lower);
    if (existing) {
        return existing.id;
    }
    const result = insertAirline.run(name);
    if (result.lastInsertRowid) {
        return Number(result.lastInsertRowid);
    }
    const fallback = findAirline.get(lower);
    return fallback ? fallback.id : null;
};

const importData = db.transaction(() => {
    airportRecords.forEach((record) => {
        const keys = Object.keys(record);
        const codeKey = keys.find((key) => key && /iata/i.test(key));
        if (!codeKey) return;
        const code = normalizeCode(record[codeKey]);
        if (!code || code === '\\N') return;
        insertAirport.run(code, record.name || '', record.city || record.municipality || '', record.country || record.iso_country || '');
    });

    routeRecords.forEach((row) => {
        const airlineName = (row['Airline'] || '').trim();
        const fromCode = normalizeCode(row['Source airport']);
        const toCode = normalizeCode(row['Destination airport']);
        if (!airlineName || !fromCode || !toCode) return;
        const airlineId = getOrCreateAirlineId(airlineName);
        insertRoute.run(airlineName, airlineId, fromCode, toCode);
    });
});

importData();
console.log(`Imported ${airportRecords.length} airports and ${routeRecords.length} routes (duplicates skipped).`);
