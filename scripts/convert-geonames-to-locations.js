#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const baseDir = process.argv[2] || path.join(__dirname, '..', 'data', 'geonames');
const outputPath = process.argv[3] || path.join(__dirname, '..', 'data', 'locations.csv');

const countryInfoPath = path.join(baseDir, 'countryInfo.txt');
const admin1Path = path.join(baseDir, 'admin1CodesASCII.txt');
const citiesPath = path.join(baseDir, 'cities15000.txt');

if (!fs.existsSync(countryInfoPath) || !fs.existsSync(admin1Path) || !fs.existsSync(citiesPath)) {
    console.error('Missing GeoNames files.');
    console.error('Expected: countryInfo.txt, admin1CodesASCII.txt, cities15000.txt');
    console.error(`Base dir: ${baseDir}`);
    process.exit(1);
}

const parseTsv = (content) => {
    return content
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.split('\t'));
};

const countries = new Map();
const countryRows = parseTsv(fs.readFileSync(countryInfoPath, 'utf8'));
countryRows.forEach((cols) => {
    const code = cols[0]?.trim();
    const name = cols[4]?.trim();
    if (code && name) {
        countries.set(code, name);
    }
});

const admin1 = new Map();
const adminRows = parseTsv(fs.readFileSync(admin1Path, 'utf8'));
adminRows.forEach((cols) => {
    const code = cols[0]?.trim();
    const name = cols[1]?.trim();
    if (code && name) {
        admin1.set(code, name);
    }
});

const seen = new Set();
const lines = ['country_code,country_name,state_code,state_name,city_name'];

const cityRows = parseTsv(fs.readFileSync(citiesPath, 'utf8'));
cityRows.forEach((cols) => {
    const countryCode = cols[8]?.trim();
    const admin1Code = cols[10]?.trim();
    const cityName = cols[2]?.trim();
    if (!countryCode || !cityName) return;
    const countryName = countries.get(countryCode);
    if (!countryName) return;
    const stateCode = admin1Code || '';
    const stateName = admin1Code ? admin1.get(`${countryCode}.${admin1Code}`) || '' : '';
    const key = `${countryCode}|${stateCode}|${cityName}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(
        [
            countryCode,
            countryName,
            stateCode,
            stateName,
            cityName
        ]
            .map((value) => `"${String(value).replace(/\"/g, '""')}"`)
            .join(',')
    );
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${lines.length - 1} rows to ${outputPath}`);
