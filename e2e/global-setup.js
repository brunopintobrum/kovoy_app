const fs = require('fs');
const path = require('path');

const removeIfExists = (filePath) => {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
};

module.exports = async () => {
    const dbPath = path.join(__dirname, '..', 'data', 'e2e.db');
    removeIfExists(dbPath);
    removeIfExists(`${dbPath}-wal`);
    removeIfExists(`${dbPath}-shm`);
};
