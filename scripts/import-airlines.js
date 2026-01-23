#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const Database = require('better-sqlite3');

const DEFAULT_CSV = process.platform === 'win32'
    ? 'C:\\\\Users\\\\bruno\\\\Downloads\\\\airlines.csv'
    : path.join(process.env.HOME || '.', 'Downloads', 'airlines.csv');
const csvPath = process.argv[2] || DEFAULT_CSV;
if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
}

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');
if (!fs.existsSync(dbPath)) {
    console.error(`Database file not found: ${dbPath}`);
    process.exit(1);
}

const db = new Database(dbPath);
const parser = parse(fs.readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true
});

const names = parser
    .map((row) => row.Name?.trim())
    .filter(Boolean);

if (!names.length) {
    console.log('No airline names found in CSV.');
    process.exit(0);
}

const insert = db.prepare('INSERT OR IGNORE INTO airlines (name) VALUES (?)');
const insertMany = db.transaction((items) => {
    for (const item of items) {
        insert.run(item);
    }
});

insertMany(names);
console.log(`Imported ${names.length} airline names (duplicates skipped).`);
