// lib/mediaCache.js
// Saves and serves media files for the live monitor.
// Files expire after 1 hour. In-memory cache for fast repeated access.

const fs = require("fs");
const path = require("path");
const os = require("os");

const MEMORY_TTL_MS = 15 * 60 * 1000;      // 15 min in memory
const DISK_MAX_AGE_MS = 60 * 60 * 1000;    // 1h on disk
const CLEANUP_EVERY_MS = 10 * 60 * 1000;   // every 10 min

const memory = new Map();  // fileId -> { buffer, mime, ts }

// Where media files live
const MEDIA_DIR = path.join(__dirname, "..", "public", "live-media");

function ensureMediaDir(sessionId) {
    const dir = path.join(MEDIA_DIR, sessionId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/**
 * Save a media buffer to memory and disk.
 * Returns a public URL path like /live-media/<sessionId>/<filename>
 */
function saveMedia(sessionId, buffer, ext, mime) {
    if (!buffer || !buffer.length) return null;

    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const dir = ensureMediaDir(sessionId || "default");
    const filePath = path.join(dir, filename);

    try {
        fs.writeFileSync(filePath, buffer);
    } catch (e) {
        console.error("mediaCache saveMedia disk:", e.message);
    }

    // Memory cache
    const fileId = `${sessionId || "default"}/${filename}`;
    memory.set(fileId, { buffer, mime: mime || "application/octet-stream", ts: Date.now() });

    return `/live-media/${sessionId || "default"}/${filename}`;
}

/**
 * Get from memory by filename (public URL suffix).
 */
function getFromMemory(fileId) {
    const e = memory.get(fileId);
    if (!e) return null;
    if (Date.now() - e.ts > MEMORY_TTL_MS) {
        memory.delete(fileId);
        return null;
    }
    return e;
}

/**
 * Cleanup: delete disk files older than DISK_MAX_AGE_MS
 */
function cleanupDisk() {
    if (!fs.existsSync(MEDIA_DIR)) return;

    const now = Date.now();
    let deleted = 0;

    try {
        for (const sessionId of fs.readdirSync(MEDIA_DIR)) {
            const sessionDir = path.join(MEDIA_DIR, sessionId);
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

            try {
                if (fs.readdirSync(sessionDir).length === 0) {
                    fs.rmdirSync(sessionDir);
                }
            } catch {}
        }
    } catch (e) {
        console.error("mediaCache cleanupDisk:", e.message);
    }

    if (deleted > 0) console.log(`🧹 mediaCache: removed ${deleted} expired file(s)`);
}

// Periodic cleanup
setInterval(cleanupDisk, CLEANUP_EVERY_MS).unref();

// Clear memory every 5 min
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of memory) {
        if (now - v.ts > MEMORY_TTL_MS) memory.delete(k);
    }
}, 5 * 60 * 1000).unref();

// Legacy exports (for compat)
function putInMemory(filename, buffer, mime) {
    memory.set(filename, { buffer, mime: mime || "application/octet-stream", ts: Date.now() });
}
function cleanupDiskLegacy() { cleanupDisk(); }

module.exports = {
    saveMedia,
    getFromMemory,
    cleanupDisk,
    // legacy
    putInMemory,
    cleanupDisk: cleanupDiskLegacy,
    MEDIA_DIR
};