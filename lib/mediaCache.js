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

// ============================================================
//   saveMedia — called by handler.js and index.js
//   Writes buffer to /public/live-media/<sessionId>/<file>
//   Also caches in memory for fast serving.
//   Returns the public URL path.
// ============================================================
function saveMedia(sessionId, buffer, ext = "bin", mime = "application/octet-stream") {
    try {
        if (!sessionId || !buffer) return null;

        const base = path.join(__dirname, "..", "public", "live-media");
        const dir = path.join(base, String(sessionId));
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const ts = Date.now();
        const rand = Math.random().toString(36).slice(2, 8);
        const filename = `${ts}_${rand}.${ext}`;
        const filepath = path.join(dir, filename);

        fs.writeFileSync(filepath, buffer);

        // Also keep in memory for the fast path
        const memKey = `${sessionId}/${filename}`;
        putInMemory(memKey, buffer, mime);

        // Public URL (served by Express route /live-media/:sessionId/:file)
        return `/live-media/${sessionId}/${filename}`;
    } catch (e) {
        console.error("mediaCache.saveMedia error:", e.message);
        return null;
    }
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

setInterval(cleanupDisk, CLEANUP_EVERY_MS).unref();

setInterval(() => {
    const now = Date.now();
    for (const [k, v] of memory) {
        if (now - v.ts > CACHE_TTL_MS) memory.delete(k);
    }
}, 5 * 60 * 1000).unref();

module.exports = {
    saveMedia,
    putInMemory,
    getFromMemory,
    cleanupDisk
};