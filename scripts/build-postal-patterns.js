const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_SOURCE = path.join(
    ROOT_DIR,
    '.tmp',
    'libaddressinput',
    'libaddressinput-master',
    'testdata',
    'countryinfo.txt'
);
const OUTPUT_PATH = path.join(ROOT_DIR, 'public', 'data', 'postal-patterns.json');

const sourcePath = process.argv[2] || DEFAULT_SOURCE;

if (!fs.existsSync(sourcePath)) {
    console.error(`Source file not found: ${sourcePath}`);
    process.exit(1);
}

const lines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/);
const patterns = {};

lines.forEach((line) => {
    if (!line) return;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) return;
    const key = line.slice(0, separatorIndex).trim();
    const payload = line.slice(separatorIndex + 1).trim();
    const match = key.match(/^data\/([A-Z]{2})$/);
    if (!match) return;
    let data = null;
    try {
        data = JSON.parse(payload);
    } catch (err) {
        return;
    }
    if (!data?.zip) return;
    const exampleRaw = typeof data.zipex === 'string' ? data.zipex : '';
    const example = exampleRaw.split(/[,|:]/).map((item) => item.trim()).filter(Boolean)[0] || '';
    const regions = {};
    const subKeys = typeof data.sub_keys === 'string' ? data.sub_keys.split('~') : [];
    const subNames = typeof data.sub_names === 'string' ? data.sub_names.split('~') : [];
    const subLNames = typeof data.sub_lnames === 'string' ? data.sub_lnames.split('~') : [];
    const subZips = typeof data.sub_zips === 'string' ? data.sub_zips.split('~') : [];
    if (subKeys.length && subZips.length) {
        subKeys.forEach((subKey, index) => {
            const zip = subZips[index];
            if (!zip) return;
            const key = subKey.trim();
            if (key) regions[key] = zip;
            const name = (subNames[index] || '').trim();
            if (name) regions[name] = zip;
            const lname = (subLNames[index] || '').trim();
            if (lname) regions[lname] = zip;
        });
    }
    const entry = {
        pattern: data.zip,
        example
    };
    if (Object.keys(regions).length) {
        entry.regions = regions;
    }
    patterns[match[1]] = entry;
});

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(patterns, null, 2));
console.log(`Postal patterns saved to ${OUTPUT_PATH}`);
