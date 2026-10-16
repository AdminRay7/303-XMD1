// commands/antispam.js
// Rate-limits users who send too many messages in a short window.
// Also blocks duplicate messages (same text sent repeatedly).
// Toggle: .antispam on | off | (no args = show state)
// Scope: per-group (each group has its own setting)
//
// Rules:
//   - Owner + group admins exempt
//   - Bot itself exempt
//   - Default: 5 messages within 5 seconds = spam → delete + warn
//   - Repeated identical messages = spam → delete + warn

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

// ---- in-memory tracking ----
// Map<groupJid, Map<senderJid, { times: [ms], lastText: string, warnings: number }>>
const tracker = new Map();

const WINDOW_MS     = 5000;   // 5 second window
const MAX_MSGS      = 5;      // more than this in window = spam
const WARN_COOLDOWN = 30000;  // don't warn same user more than once per 30s
const CLEANUP_EVERY = 60000;  // cleanup old entries every 60s

// ---- helpers ----
function bareNum(jid) {
    return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

async function isBotGroupAdmin(conn, groupJid) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        const botBare = bareNum(conn.user?.id);
        const botLidBare = bareNum(conn.user?.lid);
        const me = meta.participants.find(p => {
            const pidBare = bareNum(p.id);
            return pidBare === botBare || (botLidBare && pidBare === botLidBare);
        });
        if (!me) return false;
        return me.admin === 'admin' || me.admin === 'superadmin';
    } catch { return false; }
}

async function isGroupAdmin(conn, groupJid, senderJid) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        const senderBare = bareNum(senderJid);
        return meta.participants.some(p =>
            bareNum(p.id) === senderBare &&
            (p.admin === 'admin' || p.admin === 'superadmin')
        );
    } catch { return false; }
}

function getSender(groupJid, sender) {
    let group = tracker.get(groupJid);
    if (!group) { group = new Map(); tracker.set(groupJid, group); }

    let entry = group.get(sender);
    if (!entry) {
        entry = { times: [], lastText: '', warnings: 0, lastWarn: 0 };
        group.set(sender, entry);
    }
    return entry;
}

// Periodic cleanup — drop entries older than the window
setInterval(() => {
    const now = Date.now();
    for (const [groupJid, group] of tracker) {
        for (const [sender, entry] of group) {
            entry.times = entry.times.filter(t => now - t < WINDOW_MS);
            if (entry.times.length === 0 && now - entry.lastWarn > 5 * 60 * 1000) {
                group.delete(sender);
            }
        }
        if (group.size === 0) tracker.delete(groupJid);
    }
}, CLEANUP_EVERY).unref();

// ---- command ----
module.exports = {
    name: 'antispam',
    category: 'auto',
    aliases: ['as'],
    description: 'Rate-limit spammers in a group',
    toggleKey: 'antispam',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;

        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only command.') });

        if (!(await isBotGroupAdmin(conn, from))) {
            return conn.sendMessage(from, { text: fancy('❌ I must be a group admin to use this.') });
        }

        const action = (args[0] || '').toLowerCase();

        if (action === '') {
            const on = await autoToggles.get(userId, 'antispam', from, config.antispam === true);
            return conn.sendMessage(from, {
                text: fancy(
                    `🛡️ Anti-Spam in this group: ${on ? '✅ ON' : '❌ OFF'}\n` +
                    `Rule: ${MAX_MSGS}+ msgs in ${WINDOW_MS / 1000}s = spam`
                )
            }, { quoted: msg });
        }
        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}antispam on|off`) });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'antispam', from, value);

        // Reset tracker for this group when toggled
        if (value) tracker.delete(from);

        return conn.sendMessage(from, {
            text: fancy(`✅ Anti-Spam ${value ? 'ENABLED' : 'DISABLED'} for this group.`)
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const { from, sender, isGroup, isOwner, body, userId } = ctx;

        if (!isGroup) return false;
        if (isOwner) return false;
        if (msg.key.fromMe) return false;
        if (!body || !body.trim()) return false;
        // Skip commands
        if (body.startsWith(config.prefix)) return false;

        // Admin exempt
        if (await isGroupAdmin(conn, from, sender)) return false;

        // Bot must be group admin to enforce
        if (!(await isBotGroupAdmin(conn, from))) return false;

        const now = Date.now();
        const entry = getSender(from, sender);

        // ---- Duplicate spam check ----
        const normalized = body.trim().toLowerCase().slice(0, 200);
        if (entry.lastText === normalized && entry.times.length >= 2) {
            // Duplicate text + already sent twice quickly = spam
            await punish(conn, from, sender, msg, entry, 'duplicate');
            entry.lastText = normalized;
            entry.times.push(now);
            entry.times = entry.times.filter(t => now - t < WINDOW_MS);
            return true;
        }
        entry.lastText = normalized;

        // ---- Rate spam check ----
        entry.times.push(now);
        entry.times = entry.times.filter(t => now - t < WINDOW_MS);

        if (entry.times.length > MAX_MSGS) {
            await punish(conn, from, sender, msg, entry, 'rate');
            return true;
        }

        return false;
    }
};

// ---- Punishment ----
async function punish(conn, from, sender, msg, entry, kind) {
    // Delete the triggering message
    try {
        await conn.sendMessage(from, { delete: msg.key });
    } catch (e) {
        console.error('[antispam] delete failed:', e.message);
    }

    // Warn — with cooldown so we don't spam the chat
    const now = Date.now();
    if (now - entry.lastWarn > WARN_COOLDOWN) {
        entry.lastWarn = now;
        entry.warnings++;
        const senderBare = bareNum(sender);
        const text = kind === 'duplicate'
            ? `⚠️ @${senderBare} stop repeating the same message.`
            : `⚠️ @${senderBare} slow down — you're sending too fast.`;
        try {
            await conn.sendMessage(from, {
                text: require('../lib/font').fancy(text),
                mentions: [sender]
            });
        } catch (e) {
            console.error('[antispam] warn failed:', e.message);
        }
    }

    // After 3 warnings → kick (optional)
    if (entry.warnings >= 3) {
        try {
            await conn.groupParticipantsUpdate(from, [sender], 'remove');
            entry.warnings = 0;
            console.log(`[antispam] kicked ${sender} after 3 warnings`);
        } catch (e) {
            console.error('[antispam] kick failed:', e.message);
        }
    }
}