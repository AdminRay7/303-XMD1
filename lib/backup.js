// lib/backup.js
// Simple JSON-based backup/restore across all xmd303 collections.

const mongoose = require("mongoose");
const fs = require("fs-extra");
const path = require("path");

const COLLECTIONS = [
    "accounts",
    "users",
    "sessionsettings",
    "messagelogs",
    "liveevents",
    "autoreplies",
    "keywordtriggers",
    "channelposts",
    "apikeys",
    "auditlogs",
    "commandusages",
    "paymentinvoices"
];

async function createBackup() {
    const db = mongoose.connection.db;
    const backup = {
        version: 1,
        createdAt: new Date().toISOString(),
        collections: {}
    };

    for (const name of COLLECTIONS) {
        try {
            const docs = await db.collection(name).find({}).toArray();
            backup.collections[name] = docs;
        } catch (e) {
            backup.collections[name] = [];
        }
    }

    return backup;
}

async function saveBackupToFile(dir = "./backups") {
    await fs.ensureDir(dir);
    const backup = await createBackup();
    const name = `backup_${Date.now()}.json`;
    const fp = path.join(dir, name);
    await fs.writeFile(fp, JSON.stringify(backup, null, 2));
    return { file: name, path: fp, size: (await fs.stat(fp)).size };
}

async function restoreFromJSON(backup, { dropFirst = true } = {}) {
    if (!backup?.collections) throw new Error("Invalid backup file");

    const db = mongoose.connection.db;
    const stats = {};

    for (const [name, docs] of Object.entries(backup.collections)) {
        try {
            if (dropFirst) await db.collection(name).deleteMany({});
            if (docs.length) await db.collection(name).insertMany(docs);
            stats[name] = docs.length;
        } catch (e) {
            stats[name] = `error: ${e.message}`;
        }
    }
    return stats;
}

async function listBackups(dir = "./backups") {
    if (!(await fs.pathExists(dir))) return [];
    const files = await fs.readdir(dir);
    const out = [];
    for (const f of files.filter(x => x.endsWith(".json"))) {
        const stat = await fs.stat(path.join(dir, f));
        out.push({ file: f, size: stat.size, createdAt: stat.mtimeMs });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = { createBackup, saveBackupToFile, restoreFromJSON, listBackups };
