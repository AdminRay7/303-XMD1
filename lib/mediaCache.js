// lib/mediaCache.js
// Keeps recently-served media in memory (fast path) while
// periodically cleaning the disk folder to prevent bloat.

const fs = require("fs");
const path = require("path");

const CACHE_TTL_MS = 15 * 60 * 1000;      // 15 min in memory
const CLEANUP_EVERY_MS = 10 * 60 * 1000;  // check every 10 min
const DISK_MAX_AGE_MS = 60 * 60 * 1000;   // delete files older than 1h

const memory = new Map(); // filename -> { buffer, mime, ts }

function putInMemory(filename, buffer, mime = "application/octet-stream") {
    memory.set(filename, { buffer, mime, ts: Date.now() });
    if (memory.size > 300) {
        const oldest = [...memory.entries()]
            .sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) memory.delete(oldest[0]);
    }
}

function getFromMemory(filename) {
    const e = memory.get(filename);
    if (!e) return null;
    if (Date.now() - e.ts > CACHE_TTL_MS) {
        memory.delete(filename);
        return null;
    }
    return e;
}

function cleanupDisk() {
    const base = path.join(__dirname, "..", "public", "live-media");
    if (!fs.existsSync(base)) return;

    const now = Date.now();
    let deleted = 0;

    try {
        for (const sessionId of fs.readdirSync(base)) {
            const sessionDir = path.join(base, sessionId);
            if (!fs.statSync(sessionDir).isDirectory()) continue;

            for (const file of fs.readdirSync(sessionDir)) {
                const fp = path.join(sessionDir, file);
                try {
                    const stat = fs.statSync(fp);
                    if (now - stat.mtimeMs > DISK_MAX_AGE_MS) {
                        fs.unlinkSync(fp);
                        deleted++;
                    }
                } catch {}
            }

            // Remove empty session folder
            try {
                if (fs.readdirSync(sessionDir).length === 0) {
                    fs.rmdirSync(sessionDir);
                }
            } catch {}
        }
    } catch (e) {
        console.error("mediaCache cleanup error:", e.message);
    }

    if (deleted > 0) {
        console.log(`🧹 mediaCache: removed ${deleted} expired file(s)`);
    }
}

// Periodic cleanup (unref so it doesn't keep the process alive)
setInterval(cleanupDisk, CLEANUP_EVERY_MS).unref();

// Clear in-memory entries every 5 min
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of memory) {
        if (now - v.ts > CACHE_TTL_MS) memory.delete(k);
    }
}, 5 * 60 * 1000).unref();

module.exports = {
    putInMemory,
    getFromMemory,
    cleanupDisk
};