const fs = require('fs');
const path = require('path');

const removeIfExists = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    try {
        fs.unlinkSync(filePath);
    } catch (err) {
        if (err.code !== 'EBUSY') throw err;
        console.warn(`Arquivo em uso, ignorando limpeza: ${filePath}`);
    }
};

module.exports = async () => {
    const dbPath = path.join(__dirname, '..', 'data', 'e2e.db');
    removeIfExists(dbPath);
    removeIfExists(`${dbPath}-wal`);
    removeIfExists(`${dbPath}-shm`);
};
