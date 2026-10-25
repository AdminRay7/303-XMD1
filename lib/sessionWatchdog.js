// lib/sessionWatchdog.js
// Tracks activity of each session. If a session is disconnected and not paused,
// force-reconnect it. Paused sessions are never touched.

let heartbeatMap = new Map(); // sessionId -> last activity ms
let bootFn = null;
let isPausedFn = null;
let timer = null;
let logger = console;

const STALE_MS       = 10 * 60 * 1000;  // 10 min without any activity (used only for connected sockets)
const CHECK_EVERY_MS = 60 * 1000;       // check every 60s
const RECONNECT_GAP  = 5 * 1000;        // wait 5s between reconnects
const RETRY_AFTER_FAIL = 30 * 1000;     // retry a failed reconnect after 30s, not 10 min

// ---------- helpers ----------
function safeLog(level, ...args) {
    try {
        const fn = logger && logger[level];
        if (typeof fn === "function") fn.apply(logger, args);
    } catch { /* ignore logger errors */ }
}

function isSocketOpen(session) {
    try {
        const ws = session?.conn?.ws;
        if (!ws) return false;
        if (typeof ws.isOpen === "boolean") return ws.isOpen;
        if (typeof ws.readyState === "number") return ws.readyState === 1;
        return !!session.conn?.user;
    } catch {
        return false;
    }
}

function isPaused(session) {
    if (!session) return true;
    if (session._paused === true) return true;
    if (typeof isPausedFn === "function") {
        try { return isPausedFn(session) === true; } catch { return false; }
    }
    return false;
}

async function teardownSession(session) {
    try {
        if (typeof session?.conn?.ev?.removeAllListeners === "function") {
            session.conn.ev.removeAllListeners();
        }
        if (typeof session?.conn?.ws?.close === "function") {
            session.conn.ws.close();
        } else if (typeof session?.conn?.ws?.terminate === "function") {
            session.conn.ws.terminate();
        }
    } catch (e) {
        safeLog("error", `watchdog teardown:`, e.message);
    }
    // Ensure the boot loop starts fresh
    session.conn = null;
    session.socketReady = false;
    session.pairing = null;
    session.pairingNumber = null;
}

// ---------- public API ----------
function heartbeat(sessionId) {
    if (!sessionId) return;
    heartbeatMap.set(sessionId, Date.now());
}

function start(bootSocket, opts = {}) {
    if (typeof bootSocket !== "function") {
        throw new Error("sessionWatchdog.start requires a boot function");
    }
    bootFn = bootSocket;
    logger = (opts.logger && typeof opts.logger.log === "function") ? opts.logger : console;
    isPausedFn = typeof opts.isPaused === "function" ? opts.isPaused : null;

    if (timer) clearInterval(timer);

    timer = setInterval(async () => {
        try {
            const now = Date.now();
            const globalSessions = global.sessions || new Map();
            const reconnectQueue = [];

            for (const [sessionId, session] of globalSessions) {
                // Never touch paused sessions
                if (isPaused(session)) continue;

                const connected = !!session.conn?.user;
                const socketOpen = isSocketOpen(session);
                const ready = !!session.socketReady;

                // Case A: socket is genuinely healthy → refresh heartbeat, skip
                if (connected && socketOpen) {
                    heartbeatMap.set(sessionId, now);
                    continue;
                }

                // Case B: connected flag says yes but socket is not open → dead socket
                if (connected && !socketOpen) {
                    safeLog("warn", `🐕 [watchdog] ${sessionId} reports connected but ws is closed — reconnecting`);
                    reconnectQueue.push({ sessionId, session });
                    continue;
                }

                // Case C: never connected / not ready — see if it's been "trying" for too long
                if (!ready && !connected) {
                    // Socket never opened at all — treat startedAt as start time
                    const startedAt = session.startedAt || now;
                    if (now - startedAt > STALE_MS) {
                        safeLog("warn", `🐕 [watchdog] ${sessionId} stuck booting for ${Math.round((now - startedAt) / 1000)}s — retrying`);
                        reconnectQueue.push({ sessionId, session });
                    }
                    continue;
                }

                // Case D: ready but not connected, and no heartbeat for > STALE_MS
                const lastBeat = heartbeatMap.get(sessionId) || session.startedAt || now;
                if (now - lastBeat > STALE_MS) {
                    safeLog("warn", `🐕 [watchdog] ${sessionId} no activity for ${Math.round((now - lastBeat) / 1000)}s — reconnecting`);
                    reconnectQueue.push({ sessionId, session });
                }
            }

            // Reconnect in parallel with a small stagger (1.5s apart)
            if (reconnectQueue.length) {
                await Promise.allSettled(reconnectQueue.map(async ({ sessionId, session }, i) => {
                    await new Promise(r => setTimeout(r, i * 1500));
                    if (!globalSessions.has(sessionId)) return;
                    if (isPaused(session)) return;

                    // Mark attempt immediately so we don't double-fire if tick is slow
                    heartbeatMap.set(sessionId, Date.now());
                    await teardownSession(session);

                    try {
                        await bootFn(sessionId, session);
                        heartbeatMap.set(sessionId, Date.now());
                        safeLog("log", `🐕 [watchdog] ${sessionId} reconnected`);
                    } catch (e) {
                        safeLog("error", `watchdog reconnect ${sessionId}:`, e.message);
                        // Do NOT reset to now — schedule retry in RETRY_AFTER_FAIL
                        heartbeatMap.set(sessionId, Date.now() - STALE_MS + RETRY_AFTER_FAIL);
                    }
                }));
            }

            // Clean up heartbeats for deleted sessions
            for (const id of [...heartbeatMap.keys()]) {
                if (!globalSessions.has(id)) heartbeatMap.delete(id);
            }
        } catch (e) {
            safeLog("error", "watchdog tick error:", e.message);
        }
    }, CHECK_EVERY_MS);

    timer.unref?.();
    safeLog("log", "🐕 Session watchdog running");
}

function stop() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    heartbeatMap.clear();
    bootFn = null;
    isPausedFn = null;
    safeLog("log", "🐕 Session watchdog stopped");
}

module.exports = { start, stop, heartbeat };