// lib/autoToggles.js
// MongoDB-backed per-session + per-group toggle store for all 17 auto modules.
// Fast in-memory cache (10s refresh). Survives restarts.

const mongoose = require("mongoose");

let Toggle;
try {
    ({ Toggle } = require("../database/models"));
} catch (_) {}

if (!Toggle) {
    const toggleSchema = new mongoose.Schema({
        key: { type: String, unique: true, index: true },
        value: { type: mongoose.Schema.Types.Mixed },
        updatedAt: { type: Date, default: Date.now }
    }, { timestamps: true });

    Toggle = mongoose.models.Toggle || mongoose.model("Toggle", toggleSchema);
}

const CACHE = new Map();
const CACHE_TTL = 10_000;

function cacheGet(key) {
    const e = CACHE.get(key);
    if (!e) return undefined;
    if (Date.now() - e.ts > CACHE_TTL) { CACHE.delete(key); return undefined; }
    return e.value;
}
function cacheSet(key, value) { CACHE.set(key, { value, ts: Date.now() }); }

async function get(sessionId, module, groupJid, fallback = false) {
    try {
        if (groupJid) {
            const gKey = `${sessionId}:${groupJid}:${module}`;
            const gCached = cacheGet(gKey);
            if (gCached !== undefined) return gCached;
            const gDoc = await Toggle.findOne({ key: gKey }).lean();
            if (gDoc) { cacheSet(gKey, gDoc.value); return gDoc.value; }
        }
        const sKey = `${sessionId}:*:${module}`;
        const sCached = cacheGet(sKey);
        if (sCached !== undefined) return sCached;
        const sDoc = await Toggle.findOne({ key: sKey }).lean();
        if (sDoc) { cacheSet(sKey, sDoc.value); return sDoc.value; }
        return fallback;
    } catch (e) {
        console.error("[autoToggles] get error:", e.message);
        return fallback;
    }
}

async function set(sessionId, module, groupJid, value) {
    const key = groupJid
        ? `${sessionId}:${groupJid}:${module}`
        : `${sessionId}:*:${module}`;
    await Toggle.updateOne(
        { key },
        { $set: { value, updatedAt: new Date() } },
        { upsert: true }
    );
    cacheSet(key, value);
    return true;
}

async function getAll(sessionId, groupJid, defaults = {}) {
    const out = {};
    const MODULES = [
        "antilink","antidelete","antispam","antibug","antimedia","anticall",
        "statusview","statuslike","statusreply","welcome","goodbye",
        "autoread","autoreact","autosave","autoblock","autogreet","autorespond"
    ];
    const sDocs = await Toggle.find({ key: new RegExp(`^${escapeRegex(sessionId)}:\\*:`) }).lean();
    const sMap = {};
    for (const d of sDocs) { const mod = d.key.split(":").pop(); sMap[mod] = d.value; }
    const gMap = {};
    if (groupJid) {
        const gDocs = await Toggle.find({ key: new RegExp(`^${escapeRegex(sessionId)}:${escapeRegex(groupJid)}:`) }).lean();
        for (const d of gDocs) { const mod = d.key.split(":").pop(); gMap[mod] = d.value; }
    }
    for (const m of MODULES) {
        if (gMap[m] !== undefined)      out[m] = { value: gMap[m], scope: "group" };
        else if (sMap[m] !== undefined) out[m] = { value: sMap[m], scope: "session" };
        else                            out[m] = { value: defaults[m] ?? false, scope: "default" };
    }
    return out;
}

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clearCache() { CACHE.clear(); }

module.exports = { get, set, getAll, clearCache };
