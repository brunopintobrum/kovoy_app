const fs = require('fs');
const path = require('path');

const dbBase = path.join(__dirname, '..', 'data', 'e2e.db');
const dbFiles = [dbBase, `${dbBase}-wal`, `${dbBase}-shm`];

dbFiles.forEach((filePath) => {
    if (!fs.existsSync(filePath)) return;
    try {
        fs.unlinkSync(filePath);
    } catch (err) {
        if (err.code !== 'EBUSY') throw err;
    }
});

process.env.DB_PATH = dbBase;

const { startServer } = require('../server');

startServer(process.env.PORT || 3000);
