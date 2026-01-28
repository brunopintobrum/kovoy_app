#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const Database = require('better-sqlite3');

const csvPath = process.argv.find((arg) => !arg.startsWith('-') && arg.endsWith('.csv'));
const shouldClear = process.argv.includes('--clear');
if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('Usage: node scripts/import-locations.js <path-to-csv> [--clear]');
    process.exit(1);
}

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');
if (!fs.existsSync(dbPath)) {
    console.error(`Database file not found: ${dbPath}`);
    process.exit(1);
}

const db = new Database(dbPath);

const rows = parse(fs.readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true
});

if (!rows.length) {
    console.log('No rows found in CSV.');
    process.exit(0);
}

const insertCountry = db.prepare('INSERT OR IGNORE INTO countries (code, name) VALUES (?, ?)');
const insertState = db.prepare('INSERT OR IGNORE INTO states (country_code, code, name) VALUES (?, ?, ?)');
const insertCity = db.prepare('INSERT OR IGNORE INTO cities (country_code, state_code, name) VALUES (?, ?, ?)');

const runImport = db.transaction((items) => {
    if (shouldClear) {
        db.prepare('DELETE FROM cities').run();
        db.prepare('DELETE FROM states').run();
        db.prepare('DELETE FROM countries').run();
    }
    for (const row of items) {
        const countryCode = row.country_code?.trim();
        const countryName = row.country_name?.trim();
        const stateCode = row.state_code?.trim() || null;
        const stateName = row.state_name?.trim();
        const cityName = row.city_name?.trim();

        if (!countryCode || !countryName) {
            continue;
        }
        insertCountry.run(countryCode, countryName);
        if (stateName) {
            insertState.run(countryCode, stateCode, stateName);
        }
        if (cityName) {
            insertCity.run(countryCode, stateCode, cityName);
        }
    }
});

runImport(rows);
console.log(`Imported ${rows.length} rows into countries/states/cities.`);
