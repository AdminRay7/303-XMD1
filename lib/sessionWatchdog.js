// lib/sessionWatchdog.js
// Tracks heartbeat of each session. If a session stops pinging
// (no messages, no activity) for too long, force-reconnect it.

let heartbeatMap = new Map(); // sessionId -> last heartbeat ms
let bootFn = null;
let timer = null;
let logger = console;

const STALE_MS       = 10 * 60 * 1000;  // 10 min stale threshold
const CHECK_EVERY_MS = 60 * 1000;       // check every 60s
const RECONNECT_GAP  = 5 * 1000;        // wait 5s between reconnects

function heartbeat(sessionId) {
    if (!sessionId) return;
    heartbeatMap.set(sessionId, Date.now());
}

function start(bootSocket, opts = {}) {
    bootFn = bootSocket;
    if (opts.logger) logger = opts.logger;
    if (timer) clearInterval(timer);

    timer = setInterval(async () => {
        try {
            const now = Date.now();
            const global_sessions = global.sessions || new Map();

            for (const [sessionId, session] of global_sessions) {
                const lastBeat = heartbeatMap.get(sessionId) || session.startedAt || now;
                const isConnected = !!session.conn?.user;
                const isReady = !!session.socketReady;

                // Only police sessions that THINK they're connected
                if (!isConnected && !isReady) continue;

                // If too long without heartbeat → force reconnect
                if (now - lastBeat > STALE_MS) {
                    logger.warn?.(`🐕 [watchdog] session ${sessionId} stale (${Math.round((now - lastBeat) / 1000)}s) — reconnecting`);
                    heartbeatMap.set(sessionId, now);

                    try {
                        session.conn?.ev?.removeAllListeners?.();
                        session.conn?.ws?.close?.();
                    } catch {}

                    await new Promise(r => setTimeout(r, RECONNECT_GAP));

                    if (!global_sessions.has(sessionId)) continue;

                    try {
                        await bootFn(sessionId, session);
                    } catch (e) {
                        logger.error?.(`watchdog reconnect ${sessionId}:`, e.message);
                    }
                }
            }

            // Clean up heartbeats for deleted sessions
            for (const id of [...heartbeatMap.keys()]) {
                if (!global_sessions.has(id)) heartbeatMap.delete(id);
            }
        } catch (e) {
            logger.error?.("watchdog tick error:", e.message);
        }
    }, CHECK_EVERY_MS).unref();

    logger.log?.("🐕 Session watchdog running");
}

function stop() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    heartbeatMap.clear();
    logger.log?.("🐕 Session watchdog stopped");
}

module.exports = { start, stop, heartbeat };