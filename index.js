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
const fs = require("fs");
const config = require("./config");
const { fancy } = require("./lib/font");
const { ChannelPost, Account, SessionSettings, MessageLog, LiveEvent, AutoReply, KeywordTrigger } = require("./database/models");
const auth = require("./lib/auth");
const adminAuth = require("./lib/adminAuth");
const apiKeys = require("./lib/apiKeys");
const auditLog = require("./lib/auditLog");
const analytics = require("./lib/analytics");
const backupLib = require("./lib/backup");
const aiChat = require("./lib/aiChat");
const payments = require("./lib/payments");

const app = express();
const PORT = process.env.PORT || config.port || 3000;

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/Assets", express.static(path.join(__dirname, "Assets")));

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

function servePage(res, filename) {
    const p = path.join(__dirname, "public", filename);
    if (!fs.existsSync(p)) return res.status(404).send(`${filename} missing`);
    res.sendFile(p);
}

function isAdminAccount(account) {
    if (!account) return false;
    if (account.isAdmin === true) return true;
    const email = (account.email || "").toLowerCase();
    return Array.isArray(config.adminEmails) && config.adminEmails.includes(email);
}

async function checkIsAdmin(accountId, email) {
    const acc = await Account.findById(accountId).select("isAdmin email").lean();
    return acc?.isAdmin === true ||
        (Array.isArray(config.adminEmails) && config.adminEmails.includes((email || acc?.email || "").toLowerCase()));
}

function summarizeContent(content) {
    if (!content) return "(empty)";
    if (typeof content === "string") return content;

    const parts = [];
    if (content.text) parts.push(content.text);
    if (content.caption) parts.push("[caption] " + content.caption);
    if (content.image) parts.push("[image]");
    if (content.video) parts.push("[video]");
    if (content.audio) parts.push("[audio]");
    if (content.sticker) parts.push("[sticker]");
    if (content.document) parts.push("[document]");
    if (content.react) parts.push("[reaction: " + (content.react.text || "?") + "]");
    if (content.contacts) parts.push("[contact card]");
    if (content.poll) parts.push("[poll: " + (content.poll.name || "?") + "]");
    if (content.interactiveButtons) parts.push("[interactive button message]");
    if (content.templateButtons) parts.push("[template button message]");

    return parts.length ? parts.join(" ") : JSON.stringify(content).slice(0, 200);
}

// ---------------- API AUTH (legacy) ----------------
const API_KEY = process.env.API_KEY || config.apiKey;
function requireApiKey(req, res, next) {
    const key = req.headers["x-api-key"] || req.query.apiKey;
    if (!key || key !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
    next();
}

// ============================================
//   PAGE ROUTES
// ============================================
app.get("/",                (req, res) => servePage(res, "index.html"));
app.get("/register",        (req, res) => servePage(res, "register.html"));
app.get("/login",           (req, res) => servePage(res, "login.html"));
app.get("/dashboard",       (req, res) => servePage(res, "dashboard.html"));
app.get("/profile",         (req, res) => servePage(res, "profile.html"));
app.get("/settings",        (req, res) => servePage(res, "settings.html"));
app.get("/live",            (req, res) => servePage(res, "live.html"));
app.get("/web",             (req, res) => servePage(res, "web.html"));
app.get("/channel",         (req, res) => servePage(res, "channel.html"));
app.get("/admin",           (req, res) => servePage(res, "admin.html"));
app.get("/admin-sessions",  (req, res) => servePage(res, "admin-sessions.html"));
app.get("/admin-commands",  (req, res) => servePage(res, "admin-commands.html"));
app.get("/admin-users",     (req, res) => servePage(res, "admin-users.html"));
app.get("/admin-broadcast", (req, res) => servePage(res, "admin-broadcast.html"));
app.get("/admin-takeover",  (req, res) => servePage(res, "admin-takeover.html"));
app.get("/admin-abuse",     (req, res) => servePage(res, "admin-abuse.html"));
app.get("/admin-audit",     (req, res) => servePage(res, "admin-audit.html"));
app.get("/admin-analytics", (req, res) => servePage(res, "admin-analytics.html"));
app.get("/admin-backup",    (req, res) => servePage(res, "admin-backup.html"));
app.get("/admin-payments",  (req, res) => servePage(res, "admin-payments.html"));
app.get("/admin-ai",        (req, res) => servePage(res, "admin-ai.html"));
app.get("/api-docs",        (req, res) => servePage(res, "api-docs.html"));
app.get("/api-docs.html",   (req, res) => servePage(res, "api-docs.html"));
app.get("/pair",            (req, res) => servePage(res, "pair.html"));
app.get("/mobile",          (req, res) => servePage(res, "app.html"));
app.get("/app",             (req, res) => servePage(res, "app.html"));
app.get("/manifest.json",   (req, res) => {
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
//   AUTH ROUTES
// ============================================
app.post("/api/auth/register", async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password required" });
        if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email format" });

        const cleanEmail = email.toLowerCase().trim();
        const existing = await Account.findOne({ email: cleanEmail });
        if (existing) return res.status(409).json({ error: "Email already registered" });

        const isAdmin = config.adminEmails.includes(cleanEmail);
        const hashed = await auth.hashPassword(password);
        const account = await Account.create({ email: cleanEmail, password: hashed, name: name || "", isAdmin });

        const token = auth.signToken({ id: account._id.toString(), email: account.email });

        res.json({
            success: true, token,
            user: {
                id: account._id, email: account.email, name: account.name,
                credits: account.credits, maxSessions: account.maxSessions,
                isAdmin: isAdminAccount(account)
            }
        });
    } catch (e) {
        console.error("Register error:", e.message);
        res.status(500).json({ error: "Registration failed" });
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password required" });

        const account = await Account.findOne({ email: email.toLowerCase().trim() });
        if (!account) return res.status(401).json({ error: "Invalid email or password" });
        if (account.isBanned) return res.status(403).json({ error: "Account is banned" });

        const ok = await auth.verifyPassword(password, account.password);
        if (!ok) return res.status(401).json({ error: "Invalid email or password" });

        account.lastLogin = new Date();
        await account.save();

        const token = auth.signToken({ id: account._id.toString(), email: account.email });

        res.json({
            success: true, token,
            user: {
                id: account._id, email: account.email, name: account.name,
                credits: account.credits, maxSessions: account.maxSessions,
                isAdmin: isAdminAccount(account)
            }
        });
    } catch (e) {
        console.error("Login error:", e.message);
        res.status(500).json({ error: "Login failed" });
    }
});

app.get("/api/auth/me", auth.requireAuth, async (req, res) => {
    try {
        const account = await Account.findById(req.account.id).select("-password");
        if (!account) return res.status(404).json({ error: "Account not found" });
        res.json({
            success: true,
            user: {
                id: account._id, email: account.email, name: account.name,
                credits: account.credits, maxSessions: account.maxSessions,
                isAdmin: isAdminAccount(account),
                createdAt: account.createdAt, lastLogin: account.lastLogin
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   USER PROFILE
// ============================================
app.get("/api/user/profile", auth.requireAuth, async (req, res) => {
    try {
        const account = await Account.findById(req.account.id).select("-password").lean();
        if (!account) return res.status(404).json({ error: "Account not found" });

        const sessionsCount = await SessionSettings.countDocuments({ ownerAccountId: req.account.id });
        const messagesCount = await MessageLog.countDocuments({ accountId: req.account.id });

        res.json({
            success: true,
            user: {
                id: account._id, email: account.email, name: account.name,
                credits: account.credits, maxSessions: account.maxSessions,
                isAdmin: isAdminAccount(account),
                createdAt: account.createdAt, lastLogin: account.lastLogin
            },
            stats: { sessions: sessionsCount, messages: messagesCount }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/user/profile", auth.requireAuth, async (req, res) => {
    try {
        const { name } = req.body;
        const update = {};
        if (typeof name === "string" && name.trim()) update.name = name.trim().slice(0, 60);
        if (!Object.keys(update).length) return res.status(400).json({ error: "Nothing to update" });
        const account = await Account.findByIdAndUpdate(req.account.id, update, { new: true }).select("-password");
        res.json({ success: true, user: account });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/user/password", auth.requireAuth, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) return res.status(400).json({ error: "oldPassword and newPassword required" });
        if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });

        const account = await Account.findById(req.account.id);
        if (!account) return res.status(404).json({ error: "Not found" });

        const ok = await auth.verifyPassword(oldPassword, account.password);
        if (!ok) return res.status(401).json({ error: "Old password is incorrect" });

        account.password = await auth.hashPassword(newPassword);
        await account.save();
        res.json({ success: true, message: "Password updated" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   USER SESSIONS
// ============================================
app.get("/api/user/sessions", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        let filter = {};
        if (!isAdmin) filter.ownerAccountId = accountId;

        const sessions = await SessionSettings.find(filter).lean();
        const list = [];

        for (const s of sessions) {
            const msgCount = await MessageLog.countDocuments({ sessionId: s.sessionId });
            const live = global.sessions.get(s.sessionId);
            let phone = s.phoneNumber || null;
            if (!phone) {
                const last = await MessageLog.findOne({ sessionId: s.sessionId }).sort({ timestamp: -1 }).lean();
                if (last?.chatJid && !last.chatJid.includes("@g.us")) phone = last.chatJid.split("@")[0];
            }
            list.push({
                sessionId: s.sessionId,
                phone: phone || "pending",
                connected: !!live?.conn?.user,
                ready: !!live?.socketReady,
                jid: live?.conn?.user?.id || null,
                messageCount: msgCount,
                createdAt: s.updatedAt || null
            });
        }
        res.json({ success: true, sessions: list, isAdmin });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/user/sessions/health", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        let filter = {};
        if (!isAdmin) filter.ownerAccountId = accountId;

        const userSessions = await SessionSettings.find(filter).lean();
        let online = 0, offline = 0, connecting = 0;
        const offlineList = [];

        for (const s of userSessions) {
            const live = global.sessions.get(s.sessionId);
            const connected = !!live?.conn?.user;
            const ready = !!live?.socketReady;
            if (connected) online++;
            else if (ready) connecting++;
            else { offline++; offlineList.push({ sessionId: s.sessionId, phone: s.phoneNumber || "pending" }); }
        }
        res.json({ success: true, total: userSessions.length, online, connecting, offline, offlineSessions: offlineList });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/user/sessions/reconnect-all", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        let filter = {};
        if (!isAdmin) filter.ownerAccountId = accountId;

        const userSessions = await SessionSettings.find(filter).lean();
        let reconnected = 0;
        for (const s of userSessions) {
            const live = global.sessions.get(s.sessionId);
            if (live?.conn?.user) continue;
            if (live?._paused) continue;
            const session = live || {
                conn: null, socketReady: false, pairing: null, pairingNumber: null,
                startedAt: Date.now(), welcomed: false
            };
            global.sessions.set(s.sessionId, session);
            try { await bootSocket(s.sessionId, session); reconnected++; }
            catch (e) { console.error(`reconnect-all ${s.sessionId}:`, e.message); }
            await new Promise(r => setTimeout(r, 1500));
        }
        res.json({ success: true, reconnected });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/user/sessions/:sessionId/reconnect", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const sessionId = req.params.sessionId;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        if (!isAdmin) {
            const own = await SessionSettings.findOne({ sessionId, ownerAccountId: accountId }).lean();
            if (!own) return res.status(403).json({ error: "You don't own this session" });
        }
        const existing = global.sessions.get(sessionId);
        if (existing?.conn?.user) return res.json({ success: true, message: "Already connected" });

        const session = existing || {
            conn: null, socketReady: false, pairing: null, pairingNumber: null,
            startedAt: Date.now(), welcomed: false
        };
        session._paused = false;
        global.sessions.set(sessionId, session);
        try { await bootSocket(sessionId, session); res.json({ success: true, message: "Reconnecting…" }); }
        catch (e) { res.status(500).json({ error: e.message }); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/user/sessions/:sessionId", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const sessionId = req.params.sessionId;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        if (!isAdmin) {
            const own = await SessionSettings.findOne({ sessionId, ownerAccountId: accountId }).lean();
            if (!own) return res.status(403).json({ error: "You don't own this session" });
        }
        await logoutSession(sessionId);
        await SessionSettings.deleteOne({ sessionId });
        await MessageLog.deleteMany({ sessionId });
        res.json({ success: true, message: "Session removed" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   USER SETTINGS
// ============================================
const OVERRIDABLE_KEYS = [
    'prefix', 'botName', 'footer', 'workMode',
    'autoRead', 'autoReact', 'autoTyping',
    'antibug', 'antispam', 'antilink', 'antidelete',
    'anticall', 'antimedia'
];

app.get("/api/settings", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        let filter = {};
        if (!isAdmin) filter.ownerAccountId = accountId;

        const sessions = await SessionSettings.find(filter).lean();
        const list = sessions.map(s => {
            const settings = {};
            for (const key of OVERRIDABLE_KEYS) {
                settings[key] = s[key] !== undefined && s[key] !== null ? s[key] : config[key];
            }
            return { sessionId: s.sessionId, phone: s.phoneNumber || 'pending', settings };
        });

        res.json({
            success: true, sessions: list,
            defaults: OVERRIDABLE_KEYS.reduce((o, k) => { o[k] = config[k]; return o; }, {})
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/settings/:sessionId", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const sessionId = req.params.sessionId;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        if (!isAdmin) {
            const own = await SessionSettings.findOne({ sessionId, ownerAccountId: accountId }).lean();
            if (!own) return res.status(403).json({ error: "You don't own this session" });
        }
        const s = await SessionSettings.findOne({ sessionId }).lean();
        if (!s) return res.status(404).json({ error: "Session not found" });

        const settings = {};
        for (const key of OVERRIDABLE_KEYS) {
            settings[key] = s[key] !== undefined && s[key] !== null ? s[key] : config[key];
        }
        res.json({ success: true, sessionId, phone: s.phoneNumber, settings });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/settings/:sessionId", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const sessionId = req.params.sessionId;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        if (!isAdmin) {
            const own = await SessionSettings.findOne({ sessionId, ownerAccountId: accountId }).lean();
            if (!own) return res.status(403).json({ error: "You don't own this session" });
        }

        const updates = req.body || {};
        const clean = {};
        for (const key of OVERRIDABLE_KEYS) {
            if (updates[key] === undefined) continue;
            let v = updates[key];
            if (key === 'prefix') {
                if (typeof v !== 'string' || v.length < 1 || v.length > 3) return res.status(400).json({ error: "prefix must be 1-3 chars" });
                clean.prefix = v;
            } else if (key === 'botName' || key === 'footer') {
                if (typeof v !== 'string') return res.status(400).json({ error: `${key} must be a string` });
                clean[key] = v.slice(0, 60);
            } else if (key === 'workMode') {
                if (!['public', 'private'].includes(v)) return res.status(400).json({ error: "workMode must be public or private" });
                clean.workMode = v;
            } else if (key === 'antimedia') {
                if (!['off', 'all', 'photo', 'video', 'sticker'].includes(v)) return res.status(400).json({ error: "invalid antimedia value" });
                clean.antimedia = v;
            } else {
                clean[key] = Boolean(v);
            }
        }
        if (!Object.keys(clean).length) return res.status(400).json({ error: "No valid settings to update" });
        clean.updatedAt = new Date();
        await SessionSettings.updateOne({ sessionId }, { $set: clean }, { upsert: true });
        res.json({ success: true, applied: clean });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/settings/:sessionId/reset", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const sessionId = req.params.sessionId;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        if (!isAdmin) {
            const own = await SessionSettings.findOne({ sessionId, ownerAccountId: accountId }).lean();
            if (!own) return res.status(403).json({ error: "You don't own this session" });
        }
        const unset = {};
        for (const key of OVERRIDABLE_KEYS) unset[key] = '';
        await SessionSettings.updateOne({ sessionId }, { $unset: unset });
        res.json({ success: true, message: "Settings reset to defaults" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   LIVE MONITOR
// ============================================
app.get("/api/live/stream", adminAuth.requireAdmin, async (req, res) => {
    try {
        res.set({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        });
        res.flushHeaders();

        const heartbeat = setInterval(() => {
            try { res.write(': ping\n\n'); } catch {}
        }, 25000);

        const liveFeed = require("./lib/liveFeed");
        const listener = (event) => {
            try { res.write(`data: ${JSON.stringify(event)}\n\n`); } catch {}
        };
        liveFeed.on('event', listener);

        req.on('close', () => {
            clearInterval(heartbeat);
            liveFeed.off('event', listener);
        });
    } catch (e) {
        console.error('SSE error:', e.message);
        try { res.end(); } catch {}
    }
});

app.get("/api/live/recent", adminAuth.requireAdmin, async (req, res) => {
    try {
        const liveFeed = require("./lib/liveFeed");
        const limit = Math.min(parseInt(req.query.limit) || 200, 500);
        const sessionId = req.query.sessionId || null;
        const events = await liveFeed.getRecent(limit, sessionId);
        res.json({ success: true, events });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/live/sessions", adminAuth.requireAdmin, async (req, res) => {
    try {
        const counts = await LiveEvent.aggregate([
            { $group: { _id: "$sessionId", count: { $sum: 1 }, last: { $max: "$timestamp" } } },
            { $sort: { last: -1 } }
        ]);
        res.json({ success: true, sessions: counts });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/live/clear", adminAuth.requireAdmin, async (req, res) => {
    try {
        await LiveEvent.deleteMany({});
        res.json({ success: true, message: "Live feed cleared" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   ADMIN ROUTES
// ============================================
app.get("/api/admin/overview", adminAuth.requireAdmin, async (req, res) => {
    try {
        const totalAccounts = await Account.countDocuments();
        const totalBanned = await Account.countDocuments({ isBanned: true });
        let activeSessions = 0;
        for (const [, s] of global.sessions) if (s.conn?.user) activeSessions++;
        const mem = process.memoryUsage();
        res.json({
            accounts: totalAccounts, banned: totalBanned,
            sessions: { total: global.sessions.size, active: activeSessions, max: MAX_SESSIONS },
            system: {
                uptime: process.uptime(),
                heapMB: (mem.heapUsed / 1024 / 1024).toFixed(1),
                rssMB: (mem.rss / 1024 / 1024).toFixed(1),
                platform: process.platform,
                node: process.version
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/accounts", adminAuth.requireAdmin, async (req, res) => {
    try {
        const q = (req.query.q || "").toString().trim();
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        let filter = {};
        if (q) filter.email = { $regex: q, $options: "i" };
        const accounts = await Account.find(filter).sort({ createdAt: -1 }).limit(limit).select("-password");
        res.json({ accounts, total: accounts.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/accounts/:id", adminAuth.requireAdmin, async (req, res) => {
    try {
        const account = await Account.findById(req.params.id).select("-password");
        if (!account) return res.status(404).json({ error: "Not found" });
        res.json({ account });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/accounts/:id", adminAuth.requireAdmin, async (req, res) => {
    try {
        const { credits, isBanned, maxSessions, isAdmin } = req.body;
        const update = {};
        if (typeof credits === "number") update.credits = credits;
        if (typeof isBanned === "boolean") update.isBanned = isBanned;
        if (typeof maxSessions === "number") update.maxSessions = maxSessions;
        if (typeof isAdmin === "boolean") update.isAdmin = isAdmin;
        const account = await Account.findByIdAndUpdate(req.params.id, update, { new: true }).select("-password");
        if (!account) return res.status(404).json({ error: "Not found" });

        try {
            await auditLog.log(req, isBanned ? "ban_account" : "update_account", {
                target: account.email,
                targetType: "account",
                details: update
            });
        } catch {}

        res.json({ success: true, account });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/admin/accounts/:id", adminAuth.requireAdmin, async (req, res) => {
    try {
        const account = await Account.findByIdAndDelete(req.params.id);
        if (!account) return res.status(404).json({ error: "Not found" });

        try {
            await auditLog.log(req, "delete_account", {
                target: account.email,
                targetType: "account"
            });
        } catch {}

        res.json({ success: true, deleted: account.email });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/sessions", adminAuth.requireAdmin, async (req, res) => {
    try {
        const list = [];
        for (const [id, s] of global.sessions) {
            list.push({
                sessionId: id,
                connected: !!s.conn?.user,
                ready: s.socketReady,
                jid: s.conn?.user?.id || null,
                phone: s.conn?.user?.id ? s.conn.user.id.split(":")[0] : null,
                pairing: s.pairing || null,
                startedAt: s.startedAt
            });
        }
        res.json({ sessions: list, total: list.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/admin/sessions/:sessionId", adminAuth.requireAdmin, async (req, res) => {
    try {
        await logoutSession(req.params.sessionId);

        try {
            await auditLog.log(req, "kill_session", {
                target: req.params.sessionId,
                targetType: "session"
            });
        } catch {}

        res.json({ success: true, message: `Session ${req.params.sessionId} killed.` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/broadcast", adminAuth.requireAdmin, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || text.trim().length === 0) return res.status(400).json({ error: "text required" });
        let sent = 0, failed = 0;
        for (const [sessionId, s] of global.sessions) {
            if (!s.conn?.user) continue;
            try {
                await s.conn.sendMessage(s.conn.user.id, { text });
                sent++;
                await new Promise(r => setTimeout(r, 800));
            } catch { failed++; }
        }

        try {
            await auditLog.log(req, "broadcast", {
                targetType: "system",
                details: { sent, failed, preview: text.slice(0, 100) }
            });
        } catch {}

        res.json({ success: true, sent, failed });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   ADMIN — SESSION CONTROL (on/off toggle)
// ============================================
app.get("/api/admin/sessions/status", adminAuth.requireAdmin, async (req, res) => {
    try {
        const all = await SessionSettings.find({}).lean();

        const list = all.map(s => {
            const live = global.sessions.get(s.sessionId);
            const running = !!live;
            const connected = !!live?.conn?.user;
            const manuallyOff = live?._paused === true;

            return {
                sessionId: s.sessionId,
                phone: s.phoneNumber || "pending",
                ownerAccountId: s.ownerAccountId || null,
                running,
                connected,
                paused: manuallyOff,
                jid: live?.conn?.user?.id || null,
                startedAt: live?.startedAt || null
            };
        });

        for (const [id, live] of global.sessions) {
            if (!list.find(x => x.sessionId === id)) {
                list.push({
                    sessionId: id,
                    phone: live?.conn?.user?.id?.split(":")[0] || "unknown",
                    ownerAccountId: null,
                    running: true,
                    connected: !!live?.conn?.user,
                    paused: live?._paused === true,
                    jid: live?.conn?.user?.id || null,
                    startedAt: live?.startedAt || null
                });
            }
        }

        for (const s of list) {
            if (s.ownerAccountId) {
                try {
                    const acc = await Account.findById(s.ownerAccountId).select("email").lean();
                    s.ownerEmail = acc?.email || null;
                } catch {}
            }
        }

        res.json({ success: true, sessions: list, total: list.length });
    } catch (e) {
        console.error("sessions/status:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/admin/sessions/pause/:sessionId", adminAuth.requireAdmin, async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const live = global.sessions.get(sessionId);
        if (!live) {
            return res.status(404).json({ error: "Session not running" });
        }

        live._paused = true;

        try {
            live.conn?.ev?.removeAllListeners();
            live.conn?.ws?.close();
        } catch (e) { console.error("pause socket close:", e.message); }

        live.conn = null;
        live.socketReady = false;

        await auditLog.log(req, "session_pause", {
            target: sessionId,
            targetType: "session"
        }).catch(() => {});

        res.json({ success: true, message: "Session paused", sessionId });
    } catch (e) {
        console.error("sessions/pause:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/admin/sessions/resume/:sessionId", adminAuth.requireAdmin, async (req, res) => {
    try {
        const sessionId = req.params.sessionId;

        let live = global.sessions.get(sessionId);

        if (!live) {
            live = {
                conn: null,
                socketReady: false,
                pairing: null,
                pairingNumber: null,
                startedAt: Date.now(),
                welcomed: true,
                _paused: false
            };
            global.sessions.set(sessionId, live);
        }

        live._paused = false;

        if (live.conn?.user) {
            return res.json({ success: true, message: "Already running", sessionId });
        }

        try {
            await bootSocket(sessionId, live);
        } catch (e) {
            console.error("sessions/resume boot:", e.message);
            return res.status(500).json({ error: "Failed to boot socket: " + e.message });
        }

        await auditLog.log(req, "session_resume", {
            target: sessionId,
            targetType: "session"
        }).catch(() => {});

        res.json({ success: true, message: "Session resumed", sessionId });
    } catch (e) {
        console.error("sessions/resume:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================
//   ADMIN — SESSION TAKEOVER
// ============================================
app.get("/api/admin/takeover/sessions", adminAuth.requireAdmin, async (req, res) => {
    try {
        const list = [];
        for (const [id, s] of global.sessions) {
            list.push({
                sessionId: id,
                phone: s.conn?.user?.id?.split(":")[0] || "pending",
                connected: !!s.conn?.user,
                ready: !!s.socketReady,
                paused: s._paused === true
            });
        }
        res.json({ success: true, sessions: list, total: list.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/takeover/send", adminAuth.requireAdmin, async (req, res) => {
    try {
        const { sessionId, to, text } = req.body || {};
        if (!sessionId) return res.status(400).json({ error: "sessionId required" });
        if (!to)        return res.status(400).json({ error: "to required" });
        if (!text || !String(text).trim()) return res.status(400).json({ error: "text required" });

        const live = global.sessions.get(sessionId);
        if (!live?.conn?.user) return res.status(400).json({ error: "Session not connected" });

        const jid = toJid(to);
        if (!jid) return res.status(400).json({ error: "Invalid recipient" });

        const sent = await live.conn.sendMessage(jid, { text: String(text).trim() });

        try {
            await auditLog.log(req, "session_takeover_send", {
                target: to,
                targetType: "session",
                details: { sessionId, preview: String(text).slice(0, 100) }
            });
        } catch {}

        res.json({ success: true, messageId: sent?.key?.id || null });
    } catch (e) {
        console.error("takeover/send:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================
//   ADMIN — ANTI-ABUSE DASHBOARD
// ============================================
app.get("/api/admin/abuse", adminAuth.requireAdmin, async (req, res) => {
    try {
        const now = Date.now();
        const sevenDaysAgo = new Date(now - 7 * 86400000);

        const banned = await Account.countDocuments({ isBanned: true });

        const bans7d = await auditLog.AuditLog.countDocuments({
            action: { $in: ["ban_account", "delete_account"] },
            timestamp: { $gte: sevenDaysAgo }
        });

        const kills7d = await auditLog.AuditLog.countDocuments({
            action: "kill_session",
            timestamp: { $gte: sevenDaysAgo }
        });

        const pauses7d = await auditLog.AuditLog.countDocuments({
            action: { $in: ["session_pause", "session_resume"] },
            timestamp: { $gte: sevenDaysAgo }
        });

        const bans = await auditLog.AuditLog.find({
            action: { $in: ["ban_account", "delete_account"] }
        }).sort({ timestamp: -1 }).limit(15).lean();

        const kills = await auditLog.AuditLog.find({
            action: "kill_session"
        }).sort({ timestamp: -1 }).limit(15).lean();

        const pauses = await auditLog.AuditLog.find({
            action: { $in: ["session_pause", "session_resume"] }
        }).sort({ timestamp: -1 }).limit(15).lean();

        res.json({
            success: true,
            stats: { banned, bans7d, kills7d, pauses7d },
            bans, kills, pauses
        });
    } catch (e) {
        console.error("abuse:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================
//   ADMIN — COMMANDS PLAYGROUND
// ============================================
app.get("/api/admin/commands/list", adminAuth.requireAdmin, async (req, res) => {
    try {
        const handler = require("./handler");
        const cache = handler.getCommandCache ? handler.getCommandCache() : new Map();
        const auto = handler.getAutoCache ? handler.getAutoCache() : new Map();

        const seen = new Set();
        const list = [];

        for (const [, mod] of cache) {
            if (seen.has(mod)) continue;
            seen.add(mod);
            if (typeof mod.execute !== 'function') continue;
            list.push({
                name: mod.name || 'unknown',
                category: (mod.category || 'general').toLowerCase(),
                description: mod.description || '',
                aliases: Array.isArray(mod.aliases) ? mod.aliases : []
            });
        }

        for (const [, mod] of auto) {
            if (seen.has(mod)) continue;
            seen.add(mod);
            if (typeof mod.execute !== 'function') {
                list.push({
                    name: mod.name || 'unknown',
                    category: (mod.category || 'auto').toLowerCase(),
                    description: mod.description || 'Auto-detection module',
                    aliases: []
                });
            }
        }

        res.json({ success: true, commands: list, total: list.length });
    } catch (e) {
        console.error("commands/list:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/admin/commands/run", adminAuth.requireAdmin, async (req, res) => {
    try {
        const { command, args } = req.body || {};
        if (!command) return res.status(400).json({ error: "command required" });

        const handler = require("./handler");
        const cache = handler.getCommandCache ? handler.getCommandCache() : new Map();
        const mod = cache.get(String(command).toLowerCase());
        if (!mod || typeof mod.execute !== 'function') {
            return res.status(404).json({ error: `Command "${command}" not found` });
        }

        const activeSessionId = firstActive();
        const liveSession = activeSessionId ? global.sessions.get(activeSessionId) : null;
        const conn = liveSession?.conn || null;

        const ownerJid = config.ownerNumber ? config.ownerNumber + "@s.whatsapp.net" : null;

        const captured = [];
        let fakeConn = conn;

        if (conn) {
            fakeConn = Object.create(conn);
            fakeConn.sendMessage = async (jid, content, ...rest) => {
                captured.push({
                    jid: typeof jid === "string" ? jid : "(object)",
                    content: summarizeContent(content)
                });
                return { key: { id: "test_" + Date.now() } };
            };
        }

        const fakeMsg = {
            key: {
                remoteJid: ownerJid || "test@s.whatsapp.net",
                fromMe: true,
                id: "test_" + Date.now()
            },
            message: { conversation: (config.prefix || ".") + command + (args ? " " + args : "") },
            pushName: "Admin Test"
        };

        const fakeCtx = {
            from: ownerJid || "test@s.whatsapp.net",
            sender: ownerJid || "test@s.whatsapp.net",
            fancy: require("./lib/font").fancy,
            isOwner: true,
            pushname: "Admin Test",
            config,
            conn: fakeConn,
            msg: fakeMsg,
            userId: activeSessionId || "test",
            isGroup: false,
            isChannel: false,
            isStatus: false,
            body: fakeMsg.message.conversation,
            args: args ? String(args).split(/\s+/) : [],
            command: String(command).toLowerCase(),
            prefix: config.prefix || ".",
            isCmd: true
        };

        let errorMsg = null;
        try {
            await Promise.race([
                mod.execute(fakeConn, fakeMsg, fakeCtx.args, fakeCtx),
                new Promise((_, rej) => setTimeout(() => rej(new Error("Command timeout (60s)")), 60000))
            ]);
        } catch (e) {
            errorMsg = e.message;
        }

        let output = "";
        if (captured.length) {
            output = captured.map(c => c.content).join("\n\n---\n\n");
        } else if (errorMsg) {
            output = "❌ " + errorMsg;
        } else {
            output = "(Command ran but sent no output)";
        }

        res.json({
            success: !errorMsg,
            output,
            captured: captured.length,
            error: errorMsg || undefined
        });
    } catch (e) {
        console.error("commands/run:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================
//   ADMIN — AUDIT LOG
// ============================================
app.get("/api/admin/audit", adminAuth.requireAdmin, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 200, 500);
        const rows = await auditLog.list(limit, {
            adminEmail: req.query.adminEmail,
            action: req.query.action
        });
        res.json({ success: true, logs: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   ADMIN — ANALYTICS
// ============================================
app.get("/api/admin/analytics/top-commands", adminAuth.requireAdmin, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const rows = await analytics.topCommands(days, 25);
        res.json({ success: true, commands: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/analytics/hourly", adminAuth.requireAdmin, async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const rows = await analytics.hourlyVolume(hours);
        res.json({ success: true, hours: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/analytics/errors", adminAuth.requireAdmin, async (req, res) => {
    try {
        const rows = await analytics.errorsRecent(50);
        res.json({ success: true, errors: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   ADMIN — BACKUP
// ============================================
app.get("/api/admin/backup/create", adminAuth.requireAdmin, async (req, res) => {
    try {
        await auditLog.log(req, "backup_create");
        const { file, size } = await backupLib.saveBackupToFile();
        res.json({ success: true, file, sizeMB: (size / 1024 / 1024).toFixed(2) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/backup/download", adminAuth.requireAdmin, async (req, res) => {
    try {
        await auditLog.log(req, "backup_download");
        const backup = await backupLib.createBackup();
        res.setHeader("Content-Disposition", `attachment; filename="xmd_backup_${Date.now()}.json"`);
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify(backup, null, 2));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/backup/list", adminAuth.requireAdmin, async (req, res) => {
    try {
        const rows = await backupLib.listBackups();
        res.json({ success: true, backups: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   PAYMENTS
// ============================================
app.get("/api/admin/payments/packages", adminAuth.requireAdmin, (req, res) => {
    res.json({ success: true, packages: payments.PACKAGES });
});

app.post("/api/payments/checkout", auth.requireAuth, async (req, res) => {
    try {
        const { provider, packageKey } = req.body || {};
        if (!provider || !packageKey) return res.status(400).json({ error: "provider and packageKey required" });

        const acc = await Account.findById(req.account.id).lean();
        if (!acc) return res.status(404).json({ error: "Account not found" });

        let result;
        if (provider === "paystack") {
            result = await payments.paystackCheckout(req.account.id, packageKey, acc.email);
        } else if (provider === "stripe") {
            result = await payments.stripeCheckout(req.account.id, packageKey, acc.email);
        } else {
            return res.status(400).json({ error: "Unknown provider" });
        }
        res.json({ success: true, ...result });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/payments/webhook/paystack", express.json(), async (req, res) => {
    try {
        if (!payments.verifyPaystackSignature(req)) return res.status(401).json({ error: "Bad signature" });
        const ok = await payments.handlePaystackWebhook(req.body);
        res.json({ received: true, processed: ok });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/payments/webhook/stripe", express.json({ type: "application/json" }), async (req, res) => {
    try {
        const ok = await payments.handleStripeWebhook(req.body);
        res.json({ received: true, processed: ok });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   ADMIN — AI CONTROL
// ============================================
app.post("/api/admin/ai/chat", adminAuth.requireAdmin, async (req, res) => {
    try {
        const { sessionId, message } = req.body || {};
        if (!message) return res.status(400).json({ error: "message required" });
        const reply = await aiChat.askAI(message, sessionId || "admin", null);
        res.json({ success: true, reply });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/ai/clear/:sessionId", adminAuth.requireAdmin, async (req, res) => {
    aiChat.clearHistory(req.params.sessionId);
    res.json({ success: true });
});

// ============================================
//   WEB MONITOR
// ============================================
app.get("/api/web/chat/:jid", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        const jid = decodeURIComponent(req.params.jid);
        if (!jid) return res.status(400).json({ error: "jid required" });
        const sessionId = String(req.query.sessionId || "").trim();
        if (!isAdmin && sessionId) {
            const own = await SessionSettings.findOne({ sessionId, ownerAccountId: accountId }).lean();
            if (!own) return res.status(403).json({ error: "You don't own this session" });
        }
        const filter = { chatJid: jid };
        if (sessionId) filter.sessionId = sessionId;

        const total     = await MessageLog.countDocuments(filter);
        const sent      = await MessageLog.countDocuments({ ...filter, fromMe: true });
        const received  = await MessageLog.countDocuments({ ...filter, fromMe: false });
        const firstMsg  = await MessageLog.findOne(filter).sort({ timestamp: 1 }).lean();
        const lastMsg   = await MessageLog.findOne(filter).sort({ timestamp: -1 }).lean();
        const lastLive  = await LiveEvent.findOne({ chatJid: jid }).sort({ timestamp: -1 }).lean();

        const jidType = (() => {
            const bare = jid.split(":")[0];
            if (bare.endsWith("@s.whatsapp.net")) return "pn";
            if (bare.endsWith("@lid"))            return "lid";
            if (bare.endsWith("@g.us"))           return "group";
            if (bare.endsWith("@newsletter"))     return "newsletter";
            if (bare.endsWith("@broadcast"))      return "broadcast";
            return "unknown";
        })();

        res.json({
            success: true,
            chat: {
                jid, jidType, isGroup: jidType === "group",
                chatName: lastLive?.chatName || lastMsg?.chatName || jid.split("@")[0],
                sessionId: sessionId || lastMsg?.sessionId || lastLive?.sessionId || null,
                senderPhone: lastLive?.senderPhone || lastMsg?.senderPhone || null,
                senderLid: lastLive?.extra?.senderLid || null,
                senderPn: lastLive?.extra?.senderJidRaw || null,
                resolveSource: lastLive?.extra?.resolveSource || null,
                total, sent, received,
                firstSeen: firstMsg?.timestamp || null,
                lastSeen:  lastMsg?.timestamp  || null
            }
        });
    } catch (e) { console.error("web/chat error:", e.message); res.status(500).json({ error: e.message }); }
});

app.post("/api/web/history", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        const { chatJid, sessionId, before, limit } = req.body || {};
        if (!chatJid) return res.status(400).json({ error: "chatJid required" });
        if (!isAdmin && sessionId) {
            const own = await SessionSettings.findOne({ sessionId, ownerAccountId: accountId }).lean();
            if (!own) return res.status(403).json({ error: "You don't own this session" });
        }
        const filter = { chatJid };
        if (sessionId) filter.sessionId = sessionId;
        if (before)    filter.timestamp = { $lt: new Date(before) };
        const max = Math.min(parseInt(limit) || 50, 100);
        const events = await LiveEvent.find(filter).sort({ timestamp: -1 }).limit(max).lean();
        res.json({ success: true, events: events.reverse() });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/web/send", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        const { sessionId, to, text, replyToId } = req.body || {};
        if (!sessionId) return res.status(400).json({ error: "sessionId required" });
        if (!to)        return res.status(400).json({ error: "to (chatJid) required" });
        if (!text || !String(text).trim()) return res.status(400).json({ error: "text required" });

        if (!isAdmin) {
            const own = await SessionSettings.findOne({ sessionId, ownerAccountId: accountId }).lean();
            if (!own) return res.status(403).json({ error: "You don't own this session" });
        }

        const live = global.sessions.get(sessionId);
        if (!live?.conn?.user) return res.status(400).json({ error: "Session not connected" });

        const content = { text: String(text).trim() };
        if (replyToId) {
            const quoted = await MessageLog.findOne({ sessionId, _id: replyToId }).lean();
            if (quoted) {
                content.quoted = {
                    key: { remoteJid: quoted.chatJid, fromMe: quoted.fromMe === true, id: quoted._id.toString() },
                    message: { conversation: quoted.body || "" }
                };
            }
        }

        const sent = await live.conn.sendMessage(to, content);

        try {
            let accountId2 = null;
            const meta = await SessionSettings.findOne({ sessionId }).lean();
            if (meta?.ownerAccountId) accountId2 = meta.ownerAccountId;
            await MessageLog.create({
                accountId: accountId2,
                sessionId, chatJid: to,
                chatName: live.conn.store?.contacts?.[to]?.name || to.split("@")[0],
                chatType: to.endsWith("@g.us") ? "group" : "dm",
                isGroup: to.endsWith("@g.us"),
                senderJid: live.conn.user?.id || null,
                senderName: "You",
                senderPhone: live.conn.user?.id?.split(":")[0]?.split("@")[0] || null,
                fromMe: true,
                body: String(text).trim().slice(0, 500),
                messageType: "conversation",
                timestamp: new Date()
            });
        } catch (logErr) { console.error("web/send MessageLog error:", logErr.message); }

        try {
            const liveFeed = require("./lib/liveFeed");
            const botId = live.conn.user?.id || "";
            await liveFeed.push({
                sessionId, type: "message", chatJid: to,
                chatName: to.split("@")[0],
                isGroup: to.endsWith("@g.us"),
                senderJid: botId,
                senderName: "You",
                senderPhone: botId.split(":")[0]?.split("@")[0] || null,
                fromMe: true,
                text: String(text).trim().slice(0, 500),
                extra: { source: "web", msgKeyId: sent?.key?.id || null }
            });
        } catch (feedErr) { console.error("web/send liveFeed error:", feedErr.message); }

        res.json({ success: true, messageId: sent?.key?.id || null });
    } catch (e) { console.error("web/send error:", e.message); res.status(500).json({ error: e.message }); }
});

// ============================================
//   CHAT TRACKER
// ============================================
app.get("/api/chat/sessions", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        let filter = {};
        if (!isAdmin) filter.ownerAccountId = accountId;
        const sessions = await SessionSettings.find(filter).lean();
        const list = [];

        for (const s of sessions) {
            const count = await MessageLog.countDocuments({ sessionId: s.sessionId });
            const last = await MessageLog.findOne({ sessionId: s.sessionId }).sort({ timestamp: -1 }).lean();
            let ownerEmail = null;
            if (isAdmin && s.ownerAccountId) {
                const owner = await Account.findById(s.ownerAccountId).select("email").lean();
                ownerEmail = owner?.email || null;
            }
            let phone = s.phoneNumber || null;
            if (!phone && last?.senderPhone && !last.isGroup) phone = last.senderPhone;
            list.push({
                sessionId: s.sessionId,
                phone: phone || "pending…",
                ownerEmail,
                messageCount: count,
                lastMsgTime: last?.timestamp || null,
                lastPreview: last?.body || ""
            });
        }
        list.sort((a, b) => new Date(b.lastMsgTime || 0) - new Date(a.lastMsgTime || 0));
        res.json({ success: true, isAdmin, sessions: list });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/chat/list", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        const sessionId = String(req.query.sessionId || "").trim();
        if (!sessionId) return res.status(400).json({ error: "sessionId required" });
        if (!isAdmin) {
            const own = await SessionSettings.findOne({ sessionId, ownerAccountId: accountId }).lean();
            if (!own) return res.status(403).json({ error: "You don't own this session" });
        }
        const chats = await MessageLog.aggregate([
            { $match: { sessionId } },
            { $sort: { timestamp: -1 } },
            { $group: {
                _id: "$chatJid",
                chatName: { $first: "$chatName" },
                chatType: { $first: "$chatType" },
                isGroup: { $first: "$isGroup" },
                lastBody: { $first: "$body" },
                lastTime: { $first: "$timestamp" },
                lastFromMe: { $first: "$fromMe" },
                lastSenderName: { $first: "$senderName" },
                lastSenderPhone: { $first: "$senderPhone" },
                count: { $sum: 1 }
            }},
            { $sort: { lastTime: -1 } }
        ]);
        const groups = chats.filter(c => c.isGroup);
        const dms = chats.filter(c => !c.isGroup);
        res.json({ success: true, groups, dms });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/chat/conversation", auth.requireAuth, async (req, res) => {
    try {
        const accountId = req.account.id;
        const isAdmin = await checkIsAdmin(accountId, req.account.email);
        const sessionId = String(req.query.sessionId || "").trim();
        const chatJid = String(req.query.chatJid || "").trim();
        if (!sessionId || !chatJid) return res.status(400).json({ error: "sessionId and chatJid required" });
        if (!isAdmin) {
            const own = await SessionSettings.findOne({ sessionId, ownerAccountId: accountId }).lean();
            if (!own) return res.status(403).json({ error: "You don't own this session" });
        }
        const limit = Math.min(parseInt(req.query.limit) || 300, 500);
        const messages = await MessageLog.find({ sessionId, chatJid }).sort({ timestamp: 1 }).limit(limit).lean();
        res.json({ success: true, total: messages.length, messages });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   AUTOREPLY
// ============================================
async function ownsSession(accountId, email, sessionId) {
    const isAdmin = await checkIsAdmin(accountId, email);
    if (isAdmin) return true;
    const own = await SessionSettings.findOne({ sessionId, ownerAccountId: accountId }).lean();
    return !!own;
}

app.get("/api/autoreply", auth.requireAuth, async (req, res) => {
    try {
        const sessionId = String(req.query.sessionId || "").trim();
        if (!sessionId) return res.status(400).json({ error: "sessionId required" });
        const ok = await ownsSession(req.account.id, req.account.email, sessionId);
        if (!ok) return res.status(403).json({ error: "You don't own this session" });
        const rules = await AutoReply.find({ sessionId }).sort({ createdAt: -1 }).lean();
        res.json({ success: true, rules });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/autoreply", auth.requireAuth, async (req, res) => {
    try {
        const { sessionId, name, matchType, pattern, reply, isGroup, caseSensitive, enabled } = req.body || {};
        if (!sessionId) return res.status(400).json({ error: "sessionId required" });
        if (!pattern)   return res.status(400).json({ error: "pattern required" });
        if (!reply)     return res.status(400).json({ error: "reply required" });
        const ok = await ownsSession(req.account.id, req.account.email, sessionId);
        if (!ok) return res.status(403).json({ error: "You don't own this session" });

        let accountId = req.account.id;
        const s = await SessionSettings.findOne({ sessionId }).lean();
        if (s?.ownerAccountId) accountId = s.ownerAccountId;

        const validMatch = ['contains', 'exact', 'starts', 'regex'];
        const safeMatch = validMatch.includes(matchType) ? matchType : 'contains';

        const rule = await AutoReply.create({
            accountId, sessionId,
            name: String(name || '').trim().slice(0, 60),
            matchType: safeMatch,
            pattern: String(pattern).trim().slice(0, 200),
            reply: String(reply).trim().slice(0, 1000),
            isGroup: isGroup === true,
            caseSensitive: caseSensitive === true,
            enabled: enabled !== false
        });
        res.json({ success: true, rule });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/autoreply/:id", auth.requireAuth, async (req, res) => {
    try {
        const rule = await AutoReply.findById(req.params.id).lean();
        if (!rule) return res.status(404).json({ error: "Rule not found" });
        const ok = await ownsSession(req.account.id, req.account.email, rule.sessionId);
        if (!ok) return res.status(403).json({ error: "You don't own this session" });
        const updates = {};
        if (typeof req.body?.enabled === 'boolean') updates.enabled = req.body.enabled;
        if (!Object.keys(updates).length) return res.status(400).json({ error: "Nothing to update" });
        await AutoReply.updateOne({ _id: rule._id }, { $set: updates });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/autoreply/:id", auth.requireAuth, async (req, res) => {
    try {
        const rule = await AutoReply.findById(req.params.id).lean();
        if (!rule) return res.status(404).json({ error: "Rule not found" });
        const ok = await ownsSession(req.account.id, req.account.email, rule.sessionId);
        if (!ok) return res.status(403).json({ error: "You don't own this session" });
        await AutoReply.deleteOne({ _id: rule._id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   KEYWORDS
// ============================================
app.get("/api/keywords", auth.requireAuth, async (req, res) => {
    try {
        const sessionId = String(req.query.sessionId || "").trim();
        if (!sessionId) return res.status(400).json({ error: "sessionId required" });
        const ok = await ownsSession(req.account.id, req.account.email, sessionId);
        if (!ok) return res.status(403).json({ error: "You don't own this session" });
        const rules = await KeywordTrigger.find({ sessionId }).sort({ createdAt: -1 }).lean();
        res.json({ success: true, rules });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/keywords", auth.requireAuth, async (req, res) => {
    try {
        const { sessionId, keyword, reply, mediaUrl, mediaType, enabled } = req.body || {};
        if (!sessionId) return res.status(400).json({ error: "sessionId required" });
        if (!keyword)   return res.status(400).json({ error: "keyword required" });
        if (!reply)     return res.status(400).json({ error: "reply required" });
        const ok = await ownsSession(req.account.id, req.account.email, sessionId);
        if (!ok) return res.status(403).json({ error: "You don't own this session" });

        let accountId = req.account.id;
        const s = await SessionSettings.findOne({ sessionId }).lean();
        if (s?.ownerAccountId) accountId = s.ownerAccountId;

        const validMedia = ['', 'image', 'video'];
        const safeMedia = validMedia.includes(mediaType) ? mediaType : '';

        const trig = await KeywordTrigger.create({
            accountId, sessionId,
            keyword: String(keyword).trim().slice(0, 100),
            reply: String(reply).trim().slice(0, 1000),
            mediaUrl: mediaUrl ? String(mediaUrl).trim().slice(0, 500) : '',
            mediaType: safeMedia,
            enabled: enabled !== false
        });
        res.json({ success: true, rule: trig });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/keywords/:id", auth.requireAuth, async (req, res) => {
    try {
        const trig = await KeywordTrigger.findById(req.params.id).lean();
        if (!trig) return res.status(404).json({ error: "Trigger not found" });
        const ok = await ownsSession(req.account.id, req.account.email, trig.sessionId);
        if (!ok) return res.status(403).json({ error: "You don't own this session" });
        const updates = {};
        if (typeof req.body?.enabled === 'boolean') updates.enabled = req.body.enabled;
        if (!Object.keys(updates).length) return res.status(400).json({ error: "Nothing to update" });
        await KeywordTrigger.updateOne({ _id: trig._id }, { $set: updates });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/keywords/:id", auth.requireAuth, async (req, res) => {
    try {
        const trig = await KeywordTrigger.findById(req.params.id).lean();
        if (!trig) return res.status(404).json({ error: "Trigger not found" });
        const ok = await ownsSession(req.account.id, req.account.email, trig.sessionId);
        if (!ok) return res.status(403).json({ error: "You don't own this session" });
        await KeywordTrigger.deleteOne({ _id: trig._id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   API KEYS
// ============================================
app.get("/api/apikey", auth.requireAuth, async (req, res) => {
    try {
        const info = await apiKeys.getKeyInfo(req.account.id);
        res.json({ success: true, key: info });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/apikey/generate", auth.requireAuth, async (req, res) => {
    try {
        const { raw, preview } = await apiKeys.createOrRotateKey(req.account.id, req.body?.label || 'default');
        res.json({ success: true, key: raw, preview });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   PUBLIC API v1
// ============================================
app.get("/api/v1/me", apiKeys.requireApiKeyV1, async (req, res) => {
    try {
        const acc = req.apiAccount;
        res.json({
            success: true,
            account: { id: acc._id, email: acc.email, name: acc.name, isAdmin: req.isApiAdmin, credits: acc.credits, maxSessions: acc.maxSessions },
            key: { preview: req.apiKey.preview, usageCount: req.apiKey.usageCount || 0, lastUsed: req.apiKey.lastUsed || null }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/v1/sessions", apiKeys.requireApiKeyV1, async (req, res) => {
    try {
        let filter = {};
        if (!req.isApiAdmin) filter.ownerAccountId = req.apiAccount._id.toString();
        const sessions = await SessionSettings.find(filter).lean();
        const list = [];
        for (const s of sessions) {
            const live = global.sessions.get(s.sessionId);
            const msgCount = await MessageLog.countDocuments({ sessionId: s.sessionId });
            list.push({
                sessionId: s.sessionId,
                phone: s.phoneNumber || "pending",
                connected: !!live?.conn?.user,
                ready: !!live?.socketReady,
                jid: live?.conn?.user?.id || null,
                messageCount: msgCount
            });
        }
        res.json({ success: true, count: list.length, sessions: list });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/v1/send", apiKeys.requireApiKeyV1, async (req, res) => {
    try {
        const { sessionId, to, text } = req.body || {};
        if (!to)   return res.status(400).json({ error: "to required" });
        if (!text) return res.status(400).json({ error: "text required" });

        let target = sessionId ? global.sessions.get(sessionId) : null;
        if (!target) {
            let filter = {};
            if (!req.isApiAdmin) filter.ownerAccountId = req.apiAccount._id.toString();
            const owned = await SessionSettings.find(filter).lean();
            for (const s of owned) {
                const live = global.sessions.get(s.sessionId);
                if (live?.conn?.user) { target = live; break; }
            }
        }
        if (!target?.conn?.user) return res.status(400).json({ error: "No active session available" });

        if (!req.isApiAdmin && sessionId) {
            const own = await SessionSettings.findOne({ sessionId, ownerAccountId: req.apiAccount._id.toString() }).lean();
            if (!own) return res.status(403).json({ error: "You don't own this session" });
        }
        const jid = toJid(to);
        if (!jid) return res.status(400).json({ error: "Invalid recipient" });
        const sent = await target.conn.sendMessage(jid, { text: String(text).trim() });
        res.json({ success: true, messageId: sent.key.id, to: jid });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/v1/send-media", apiKeys.requireApiKeyV1, async (req, res) => {
    try {
        const { sessionId, to, url, caption, type } = req.body || {};
        if (!to)  return res.status(400).json({ error: "to required" });
        if (!url) return res.status(400).json({ error: "url required" });

        let target = sessionId ? global.sessions.get(sessionId) : null;
        if (!target) {
            let filter = {};
            if (!req.isApiAdmin) filter.ownerAccountId = req.apiAccount._id.toString();
            const owned = await SessionSettings.find(filter).lean();
            for (const s of owned) {
                const live = global.sessions.get(s.sessionId);
                if (live?.conn?.user) { target = live; break; }
            }
        }
        if (!target?.conn?.user) return res.status(400).json({ error: "No active session" });
        if (!req.isApiAdmin && sessionId) {
            const own = await SessionSettings.findOne({ sessionId, ownerAccountId: req.apiAccount._id.toString() }).lean();
            if (!own) return res.status(403).json({ error: "You don't own this session" });
        }
        const jid = toJid(to);
        if (!jid) return res.status(400).json({ error: "Invalid recipient" });
        const mediaType = type === 'video' ? 'video' : 'image';
        const content = mediaType === 'video'
            ? { video: { url }, caption: caption || '' }
            : { image: { url }, caption: caption || '' };
        const sent = await target.conn.sendMessage(jid, content);
        res.json({ success: true, messageId: sent.key.id, type: mediaType });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/v1/check-number", apiKeys.requireApiKeyV1, async (req, res) => {
    try {
        const { number, sessionId } = req.body || {};
        if (!number) return res.status(400).json({ error: "number required" });
        let target = sessionId ? global.sessions.get(sessionId) : null;
        if (!target) {
            let filter = {};
            if (!req.isApiAdmin) filter.ownerAccountId = req.apiAccount._id.toString();
            const owned = await SessionSettings.find(filter).lean();
            for (const s of owned) {
                const live = global.sessions.get(s.sessionId);
                if (live?.conn?.user) { target = live; break; }
            }
        }
        if (!target?.conn?.user) return res.status(400).json({ error: "No active session" });
        const jid = toJid(number);
        if (!jid) return res.status(400).json({ error: "Invalid number" });
        const result = await target.conn.onWhatsApp(jid);
        res.json({ exists: result?.length > 0, jid });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/v1/stats", apiKeys.requireApiKeyV1, async (req, res) => {
    try {
        const filter = {};
        if (!req.isApiAdmin) {
            const owned = await SessionSettings.find({ ownerAccountId: req.apiAccount._id.toString() }).lean();
            filter.sessionId = { $in: owned.map(o => o.sessionId) };
        }
        const total    = await MessageLog.countDocuments(filter);
        const received = await MessageLog.countDocuments({ ...filter, fromMe: false });
        const sent     = await MessageLog.countDocuments({ ...filter, fromMe: true });
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const today = await MessageLog.countDocuments({ ...filter, timestamp: { $gte: startOfDay } });
        res.json({ success: true, total, received, sent, today });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

function requireV1Admin(req, res, next) {
    if (!req.isApiAdmin) return res.status(403).json({ error: "Admin API key required" });
    next();
}

app.get("/api/v1/admin/sessions", apiKeys.requireApiKeyV1, requireV1Admin, async (req, res) => {
    try {
        const list = [];
        for (const [id, s] of global.sessions) {
            list.push({
                sessionId: id,
                connected: !!s.conn?.user,
                ready: s.socketReady,
                jid: s.conn?.user?.id || null,
                phone: s.conn?.user?.id ? s.conn.user.id.split(":")[0] : null,
                startedAt: s.startedAt
            });
        }
        res.json({ success: true, total: list.length, sessions: list });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/v1/admin/sessions/:id/kill", apiKeys.requireApiKeyV1, requireV1Admin, async (req, res) => {
    try {
        await logoutSession(req.params.id);
        res.json({ success: true, message: `Session ${req.params.id} killed` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/v1/admin/accounts", apiKeys.requireApiKeyV1, requireV1Admin, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const accounts = await Account.find({}).sort({ createdAt: -1 }).limit(limit).select("-password").lean();
        res.json({ success: true, total: accounts.length, accounts });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/v1/admin/send", apiKeys.requireApiKeyV1, requireV1Admin, async (req, res) => {
    try {
        const { sessionId, to, text } = req.body || {};
        if (!sessionId) return res.status(400).json({ error: "sessionId required" });
        if (!to)        return res.status(400).json({ error: "to required" });
        if (!text)      return res.status(400).json({ error: "text required" });
        const target = global.sessions.get(sessionId);
        if (!target?.conn?.user) return res.status(400).json({ error: "Session not connected" });
        const jid = toJid(to);
        if (!jid) return res.status(400).json({ error: "Invalid recipient" });
        const sent = await target.conn.sendMessage(jid, { text: String(text).trim() });
        res.json({ success: true, messageId: sent.key.id, from: sessionId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/v1/admin/stats", apiKeys.requireApiKeyV1, requireV1Admin, async (req, res) => {
    try {
        const totalAccounts = await Account.countDocuments();
        const totalMessages = await MessageLog.countDocuments();
        let activeSessions = 0;
        for (const [, s] of global.sessions) if (s.conn?.user) activeSessions++;
        res.json({
            success: true, accounts: totalAccounts, messages: totalMessages,
            sessions: { total: global.sessions.size, active: activeSessions, max: MAX_SESSIONS },
            uptime: process.uptime()
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
//   LEGACY / STATUS
// ============================================
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

    let accountId = null;
    try {
        const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
        if (token) accountId = auth.verifyToken(token).id;
    } catch {}

    try {
        const code = await requestPairingCodeForSession(sessionId, num);
        if (accountId) {
            try {
                await SessionSettings.updateOne(
                    { sessionId },
                    { $set: { ownerAccountId: accountId, phoneNumber: num } },
                    { upsert: true }
                );
            } catch (e) { console.error("session owner save error:", e.message); }
        }
        res.json({ success: true, sessionId, code });
    } catch (e) {
        console.error("Pair error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/stats", async (req, res) => {
    try {
        let userCount = 0, accountCount = 0;
        if (mongoose.connection.readyState === 1) {
            userCount = await Account.countDocuments();
            accountCount = userCount;
        }
        let activeSessions = 0;
        for (const [, s] of global.sessions) if (s.conn?.user) activeSessions++;
        res.json({
            users: userCount, accounts: accountCount,
            totalSessions: global.sessions.size, activeSessions,
            maxSessions: MAX_SESSIONS, uptime: process.uptime()
        });
    } catch (error) { res.json({ error: error.message }); }
});

// ---------- Channel: info ----------
app.get("/api/channel/info", requireApiKey, async (req, res) => {
    const sid = firstActive();
    const session = sid ? global.sessions.get(sid) : null;
    if (!session?.conn?.user) return res.json({ connected: false, newsletterJid: config.newsletterJid });
    try {
        const meta = await session.conn.newsletterMetadata("jid", config.newsletterJid);
        res.json({
            connected: true, newsletterJid: config.newsletterJid,
            name: meta?.name, subscribers: meta?.subscribers,
            role: meta?.viewer_metadata?.role || "UNKNOWN"
        });
    } catch (e) {
        res.json({ connected: true, newsletterJid: config.newsletterJid, error: e.message });
    }
});

app.get("/api/channel/posts", requireApiKey, async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const posts = await ChannelPost.find({ jid: config.newsletterJid })
            .sort({ timestamp: -1 }).limit(limit).lean();
        res.json({ success: true, posts });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

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
    session.id = sessionId;

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

    const originalSend = conn.sendMessage.bind(conn);
    conn.sendMessage = async function (jid, content, ...rest) {
        try {
            const liveFeed = require("./lib/liveFeed");
            const myJid = conn.user?.id || "";
            const myPhone = myJid.split(":")[0]?.split("@")[0]?.replace(/\D/g, "") || null;
            const myName = config.botName || "Bot";

            const isGroupChat = String(jid).endsWith("@g.us");
            const text = content?.text || content?.caption || null;
            const mediaType = content?.image ? "image"
                           : content?.video ? "video"
                           : content?.audio ? "audio"
                           : content?.sticker ? "sticker"
                           : content?.document ? "document"
                           : null;

            let chatName = String(jid).split("@")[0];
            if (isGroupChat) {
                try {
                    const meta = await conn.groupMetadata(jid);
                    chatName = meta.subject || chatName;
                } catch {}
            }

            await liveFeed.push({
                sessionId,
                type: "message",
                chatJid: jid,
                chatName,
                isGroup: isGroupChat,
                senderJid: myJid,
                senderName: myName,
                senderPhone: myPhone,
                recipientJid: jid,
                recipientName: chatName,
                recipientPhone: String(jid).split("@")[0]?.replace(/\D/g, "") || null,
                fromMe: true,
                text: text || (mediaType ? `[${mediaType}]` : "[message]"),
                mediaType,
                extra: { direction: "outgoing", messageId: null }
            });
        } catch (e) {
            console.error("liveFeed outgoing:", e.message);
        }

        return originalSend(jid, content, ...rest);
    };

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

            try {
                const realPhone = conn.user?.id?.split(":")[0]?.split("@")[0] || null;
                if (realPhone) {
                    await SessionSettings.updateOne({ sessionId }, { $set: { phoneNumber: realPhone } }, { upsert: true });
                }
            } catch (e) { console.error(`[${sessionId}] phone save error:`, e.message); }

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

            if (session._paused) {
                console.log(fancy(`⏸️ [${sessionId}] paused — not reconnecting`));
                return;
            }

            if (code === 401 || code === DisconnectReason.loggedOut) {
                await logoutSession(sessionId);
                return;
            }
            if (code === 440) return;
            setTimeout(() => {
                if (!global.sessions.has(sessionId)) return;
                if (session._paused) return;
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
        try {
            const h = require("./handler");
            if (typeof h.handleCallEvent === "function") await h.handleCallEvent(conn, calls);
        } catch {}
    });

    conn.ev.on("group-participants.update", async (update) => {
        try {
            const h = require("./handler");
            if (typeof h.handleGroupUpdate === "function") await h.handleGroupUpdate(conn, update);
        } catch (e) { console.error("group-participants.update:", e.message); }
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

    try {
        const watchdog = require("./lib/sessionWatchdog");
        watchdog.start(bootSocket, { logger: console });
        console.log(fancy("🐕 Session watchdog started"));
    } catch (e) { console.error("Watchdog init error:", e.message); }

    try {
        require("./lib/mediaCache");
        console.log(fancy("🧹 Media cleanup job started"));
    } catch (e) { console.error("Media cleanup init error:", e.message); }

    try { await initMongo(); await resumeAllSessions(); }
    catch (e) { console.error("Boot error:", e.message); console.error("→ Bot will run in dashboard-only mode"); }

    app.listen(PORT, () => {
        console.log(fancy(`🌐 Dashboard: http://localhost:${PORT}`));
        console.log(fancy(`🔗 Register:  http://localhost:${PORT}/register`));
        console.log(fancy(`🔐 Login:     http://localhost:${PORT}/login`));
        console.log(fancy(`📊 Dashboard: http://localhost:${PORT}/dashboard`));
        console.log(fancy(`🛡️  Admin:     http://localhost:${PORT}/admin`));
    });
})();