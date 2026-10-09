require("dotenv").config();

const {
    default: makeWASocket,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const { MongoClient } = require("mongodb");
const { useMongoDBAuthState } = require("./lib/mongoAuthState");
const pino = require("pino");
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");                                    // ← ADDED (needed for existsSync checks)
const config = require("./config");
const { fancy } = require("./lib/font");
const { ChannelPost } = require("./database/models");

const app = express();
const PORT = process.env.PORT || config.port || 3000;

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ---------------- DATABASE ----------------
if (config.mongodb) {
    mongoose.connect(config.mongodb, { dbName: "xmd303" })
        .then(() => console.log(fancy("✅ Database connected.")))
        .catch(err => console.error("DB Error:", err.message));
}

// ---------------- GLOBAL STATE ----------------
global.sessions = new Map();
global.mongoClient = null;

const MAX_SESSIONS = 12;
let pairingQueue = Promise.resolve();
function enqueuePairing(fn) {
    const next = pairingQueue.then(fn, fn);
    pairingQueue = next.catch(() => {});
    return next;
}

// ---------------- HELPERS ----------------
function toJid(input) {
    if (!input || typeof input !== "string") return null;
    if (input.includes("@")) return input;
    const digits = input.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return null;
    return digits + "@s.whatsapp.net";
}

function firstActive() {
    for (const [id, s] of global.sessions) if (s.conn?.user) return id;
    return null;
}

// Helper to serve an HTML page safely
function servePage(res, filename) {
    const p = path.join(__dirname, "public", filename);
    if (!fs.existsSync(p)) return res.status(404).send(`${filename} missing`);
    res.sendFile(p);
}

// ---------------- API AUTH ----------------
const API_KEY = process.env.API_KEY || config.apiKey;
function requireApiKey(req, res, next) {
    const key = req.headers["x-api-key"] || req.query.apiKey;
    if (!key || key !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
    next();
}

// ============================================
//   PAGE ROUTES  ← ONLY THIS SECTION CHANGED
// ============================================
app.get("/",            (req, res) => servePage(res, "index.html"));
app.get("/register",    (req, res) => servePage(res, "register.html"));
app.get("/login",       (req, res) => servePage(res, "login.html"));
app.get("/dashboard",   (req, res) => servePage(res, "dashboard.html"));
app.get("/profile",     (req, res) => servePage(res, "profile.html"));          // ← ADDED
app.get("/settings",    (req, res) => servePage(res, "settings.html"));
app.get("/live",        (req, res) => servePage(res, "live.html"));
app.get("/web",         (req, res) => servePage(res, "web.html"));              // ← CHANGED (was live.html)
app.get("/channel",     (req, res) => servePage(res, "channel.html"));          // ← ADDED
app.get("/admin",       (req, res) => servePage(res, "admin.html"));
app.get("/api-docs",    (req, res) => servePage(res, "api-docs.html"));
app.get("/api-docs.html", (req, res) => servePage(res, "api-docs.html"));       // ← ADDED (also accept .html)
app.get("/pair",        (req, res) => servePage(res, "pair.html"));
app.get("/mobile",      (req, res) => servePage(res, "app.html"));              // ← ADDED (mobile pairing)
app.get("/app",         (req, res) => servePage(res, "app.html"));              // ← ADDED (alias)
app.get("/manifest.json", (req, res) => {
    const p = path.join(__dirname, "public", "manifest.json");
    if (!fs.existsSync(p)) return res.status(404).send("manifest.json missing");
    res.type("application/json").sendFile(p);
});
app.get("/service-worker.js", (req, res) => {
    const p = path.join(__dirname, "public", "service-worker.js");
    if (!fs.existsSync(p)) return res.status(404).send("service-worker.js missing");
    res.type("application/javascript").sendFile(p);
});
// ============================================
//   END PAGE ROUTES  ← everything below is untouched
// ============================================

// ---------------- STATUS / SEND ----------------
app.get("/api/status", (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
        const all = [];
        for (const [id, s] of global.sessions) all.push({ sessionId: id, connected: !!s.conn?.user, ready: s.socketReady });
        return res.json({
            botName: config.botName, version: config.version,
            connected: all.some(s => s.connected), ready: all.some(s => s.ready),
            totalSessions: global.sessions.size, maxSessions: MAX_SESSIONS,
            uptime: process.uptime()
        });
    }
    const s = global.sessions.get(sessionId);
    if (!s) return res.json({ connected: false, ready: false, exists: false });
    res.json({ connected: !!s.conn?.user, ready: s.socketReady, exists: true, pairing: s.pairing || null });
});

app.post("/api/send", requireApiKey, async (req, res) => {
    const { sessionId, to, text } = req.body;
    if (!to || !text) return res.status(400).json({ error: "to and text required" });
    const target = sessionId || firstActive();
    const session = target ? global.sessions.get(target) : null;
    if (!session?.conn?.user) return res.status(400).json({ error: "No active session" });
    const jid = toJid(to);
    if (!jid) return res.status(400).json({ error: "Invalid recipient" });
    try {
        const sent = await session.conn.sendMessage(jid, { text });
        res.json({ success: true, messageId: sent.key.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/pair", async (req, res) => {
    const sessionId = String(req.query.sessionId || "").trim();
    const num = String(req.query.num || "").replace(/\D/g, "");
    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });
    if (!num || num.length < 10 || num.length > 15) return res.status(400).json({ error: "Invalid phone number" });
    try {
        const code = await requestPairingCodeForSession(sessionId, num);
        res.json({ success: true, sessionId, code });
    } catch (e) {
        console.error("Pair error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/stats", async (req, res) => {
    let active = 0;
    for (const [, s] of global.sessions) if (s.conn?.user) active++;
    res.json({ totalSessions: global.sessions.size, activeSessions: active, maxSessions: MAX_SESSIONS, uptime: process.uptime() });
});

// ---------- Channel: info ----------
app.get("/api/channel/info", requireApiKey, async (req, res) => {
    const sid = firstActive();
    const session = sid ? global.sessions.get(sid) : null;
    if (!session?.conn?.user) return res.json({ connected: false, newsletterJid: config.newsletterJid });
    try {
        const meta = await session.conn.newsletterMetadata("jid", config.newsletterJid);
        res.json({
            connected: true,
            newsletterJid: config.newsletterJid,
            name: meta?.name,
            subscribers: meta?.subscribers,
            role: meta?.viewer_metadata?.role || "UNKNOWN"
        });
    } catch (e) {
        res.json({ connected: true, newsletterJid: config.newsletterJid, error: e.message });
    }
});

// ---------- Channel: recent posts ----------
app.get("/api/channel/posts", requireApiKey, async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const posts = await ChannelPost.find({ jid: config.newsletterJid })
            .sort({ timestamp: -1 }).limit(limit).lean();
        res.json({ success: true, posts });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- Channel: publish ----------
app.post("/api/channel/post", requireApiKey, async (req, res) => {
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: "text required" });
    if (!config.newsletterJid) return res.status(400).json({ error: "No newsletterJid" });
    const sid = firstActive();
    const session = sid ? global.sessions.get(sid) : null;
    if (!session?.conn?.user) return res.status(400).json({ error: "No active session" });
    try {
        const sent = await session.conn.sendMessage(config.newsletterJid, { text: text.trim() });
        res.json({ success: true, messageId: sent.key.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------------- MONGO INIT ----------------
async function initMongo() {
    if (!config.mongodb) throw new Error("MONGODB_URI is not set");
    if (!global.mongoClient) {
        global.mongoClient = new MongoClient(config.mongodb);
        await global.mongoClient.connect();
        console.log(fancy("✅ MongoDB session store connected"));
    }
}

// ---------------- PAIRING ----------------
async function requestPairingCodeForSession(sessionId, phoneNumber) {
    return enqueuePairing(async () => {
        await initMongo();
        let session = global.sessions.get(sessionId);
        if (session?.conn?.user) throw new Error("Session already paired");
        if (session?.pairing && session.pairingNumber === phoneNumber) return session.pairing;

        if (!session) {
            if (global.sessions.size >= MAX_SESSIONS) throw new Error(`Server at capacity (${MAX_SESSIONS})`);
            session = { conn: null, socketReady: false, pairing: null, pairingNumber: null, startedAt: Date.now(), welcomed: false };
            global.sessions.set(sessionId, session);
            await bootSocket(sessionId, session);
        }

        const deadline = Date.now() + 30000;
        while (!session.socketReady && Date.now() < deadline) await new Promise(r => setTimeout(r, 500));
        if (!session.socketReady) throw new Error("Socket not ready, try again");

        let code;
        try { code = await session.conn.requestPairingCode(phoneNumber); }
        catch { await new Promise(r => setTimeout(r, 2000)); code = await session.conn.requestPairingCode(phoneNumber); }

        const formatted = code.match(/.{1,4}/g)?.join("-") || code;
        session.pairing = formatted;
        session.pairingNumber = phoneNumber;
        console.log(fancy(`✅ [${sessionId}] pairing code: ${formatted}`));
        return formatted;
    });
}

// ---------------- SOCKET BOOT ----------------
async function bootSocket(sessionId, session) {
    await initMongo();

    const collection = global.mongoClient.db("xmd303").collection("authState");
    const { state, saveCreds } = await useMongoDBAuthState(collection, sessionId);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari"),
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 60000,
        retryRequestDelayMs: 2000,
        fireInitQueries: false,
        emitOwnEvents: false
    });

    session.conn = conn;
    conn.ev.on("creds.update", saveCreds);

    conn.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "connecting") {
            session.socketReady = true;
            console.log(fancy(`🔌 [${sessionId}] socket ready`));
        }

        if (connection === "open") {
            session.socketReady = true;
            session.pairing = null;
            session.pairingNumber = null;
            console.log(fancy(`✅ [${sessionId}] connected as ${conn.user?.id}`));

            try {
                await collection.updateOne(
                    { _id: `${sessionId}:meta` },
                    { $set: { value: { jid: conn.user?.id, linkedAt: Date.now() } } },
                    { upsert: true }
                );
            } catch {}

            if (config.autoSubscribeChannel && config.newsletterJid) {
                try {
                    await conn.subscribeNewsletterUpdates(config.newsletterJid);
                    console.log(fancy(`📰 [${sessionId}] subscribed to ${config.newsletterJid}`));
                } catch (e) {
                    console.log(`Newsletter subscribe skipped: ${e.message}`);
                }
            }

            if (!session.welcomed && config.ownerNumber) {
                session.welcomed = true;
                try {
                    const ownerJid = toJid(String(config.ownerNumber));
                    if (ownerJid) {
                        await conn.sendMessage(ownerJid, {
                            text: `╭─── • 🔑 • ───╮\n   ${config.botName} ᴠ${config.version}\n╰─── • 🔑 • ───╯\n\n✅ New session linked!\nSession: ${sessionId}\n\n${fancy(config.footer)}`
                        });
                    }
                } catch {}
            }
        }

        if (connection === "close") {
            session.socketReady = false;
            const code = lastDisconnect?.error?.output?.statusCode;
            console.log(fancy(`❌ [${sessionId}] closed (${code})`));
            if (code === 401 || code === DisconnectReason.loggedOut) {
                await logoutSession(sessionId);
                return;
            }
            if (code === 440) return;
            setTimeout(() => {
                if (!global.sessions.has(sessionId)) return;
                bootSocket(sessionId, session).catch(e => console.error(`Reconnect ${sessionId}:`, e.message));
            }, 5000);
        }
    });

    conn.ev.on("messages.upsert", async (m) => {
        try { require("./handler")(conn, m, sessionId); }
        catch (err) { console.error(`[${sessionId}] handler:`, err); }
    });

    conn.ev.on("call", async (calls) => {
        if (!config.anticall) return;
        for (const call of calls) {
            if (call.status === "offer") {
                try { await conn.rejectCall(call.id, call.from); } catch {}
            }
        }
    });

    return conn;
}

async function logoutSession(sessionId) {
    const s = global.sessions.get(sessionId);
    if (s) {
        try { s.conn?.ev.removeAllListeners(); s.conn?.ws?.close(); } catch {}
        global.sessions.delete(sessionId);
    }
    try {
        await initMongo();
        const c = global.mongoClient.db("xmd303").collection("authState");
        await c.deleteMany({ _id: { $regex: `^${sessionId}:` } });
    } catch {}
}

async function resumeAllSessions() {
    if (!config.mongodb) return;
    try {
        await initMongo();
        const c = global.mongoClient.db("xmd303").collection("authState");
        const metas = await c.find({ _id: { $regex: ":meta$" } }).toArray();
        console.log(fancy(`🔄 Resuming ${metas.length} session(s)...`));
        for (const meta of metas) {
            const sessionId = meta._id.replace(/:meta$/, "");
            if (global.sessions.has(sessionId)) continue;
            if (global.sessions.size >= MAX_SESSIONS) break;
            const session = { conn: null, socketReady: false, pairing: null, pairingNumber: null, startedAt: Date.now(), welcomed: false };
            global.sessions.set(sessionId, session);
            try { await bootSocket(sessionId, session); }
            catch (e) { console.error(`Resume ${sessionId}:`, e.message); }
            await new Promise(r => setTimeout(r, 1500));
        }
    } catch (e) { console.error("Resume error:", e.message); }
}

// ---------------- SHUTDOWN ----------------
async function shutdown(sig) {
    console.log(fancy(`\n🛑 ${sig} — shutting down...`));
    try {
        for (const [, s] of global.sessions) { s.conn?.ev?.removeAllListeners(); s.conn?.ws?.close(); }
        if (global.mongoClient) await global.mongoClient.close();
        if (mongoose.connection.readyState === 1) await mongoose.connection.close();
    } catch {}
    process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", r => console.error("Unhandled:", r));

// ---------------- BOOT ----------------
(async () => {
    console.log(fancy(`🚀 Starting ${config.botName} v${config.version}...`));
    try { await initMongo(); await resumeAllSessions(); }
    catch (e) { console.error("Boot error:", e.message); console.error("→ Bot will run in dashboard-only mode"); }
    app.listen(PORT, () => console.log(fancy(`🌐 Dashboard: http://localhost:${PORT}`)));
})();