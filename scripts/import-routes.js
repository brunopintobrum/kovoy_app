#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { parse } = require('csv-parse/sync');

const DEFAULT_AIRPORTS = process.platform === 'win32'
    ? 'C:\\\\Users\\\\bruno\\\\Downloads\\\\airports.csv'
    : path.join(process.env.HOME || '.', 'Downloads', 'airports.csv');

const argTwo = process.argv[2] || '';
const argThree = process.argv[3] || '';
const onlyAirportsArg = argTwo && !argThree && /airports\.csv$/i.test(argTwo);
const routesPath = onlyAirportsArg ? '' : argTwo;
const airportsPath = onlyAirportsArg ? argTwo : (argThree || DEFAULT_AIRPORTS);
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');

if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exit(1);
}

if (!fs.existsSync(airportsPath)) {
    console.error(`Airports file not found: ${airportsPath}`);
    process.exit(1);
}

const db = new Database(dbPath);
const airportColumns = db.prepare('PRAGMA table_info(airports)').all();
const hasAirportNameNormalized = airportColumns.some((column) => column.name === 'name_normalized');
const hasAirportCityNormalized = airportColumns.some((column) => column.name === 'city_normalized');
if (!hasAirportNameNormalized) {
    db.exec('ALTER TABLE airports ADD COLUMN name_normalized TEXT');
}
if (!hasAirportCityNormalized) {
    db.exec('ALTER TABLE airports ADD COLUMN city_normalized TEXT');
}
const insertAirport = db.prepare(`
    INSERT OR REPLACE INTO airports (code, name, city, country, name_normalized, city_normalized)
    VALUES (?, ?, ?, ?, ?, ?)
`);
const insertRoute = db.prepare('INSERT OR IGNORE INTO route_airlines (airline_name, airline_id, from_code, to_code) VALUES (?, ?, ?, ?)');
const findAirline = db.prepare('SELECT id FROM airlines WHERE LOWER(name) = ?');
const insertAirline = db.prepare('INSERT OR IGNORE INTO airlines (name) VALUES (?)');

const airportCsv = fs.readFileSync(airportsPath, 'utf8');
const airportRecords = parse(airportCsv, {
    columns: true,
    skip_empty_lines: true,
    trim: true
});

let routeRecords = [];
if (routesPath && fs.existsSync(routesPath)) {
    const routeCsv = fs.readFileSync(routesPath, 'utf8');
    routeRecords = parse(routeCsv, {
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
}

const normalizeCode = (value) => {
    if (!value) return '';
    return value.trim().toUpperCase();
};

const normalizeSearch = (value) => {
    if (!value) return '';
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
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
        const name = record.name || record.Name || '';
        const city = record.city || record.City || record.municipality || record.Municipality || '';
        const country = record.country || record.Country || record.iso_country || record.isoCountry || '';
        insertAirport.run(
            code,
            name,
            city,
            country,
            normalizeSearch(name),
            normalizeSearch(city)
        );
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
