// commands/antibug.js
// Anti-bug — detects and removes malicious unicode (zalgo), zero-width
// characters, and oversized messages that crash or freeze WhatsApp clients.
// Toggle: .antibug on | off | (no args = show state)
// Scope: session-wide (all groups + DMs).

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

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

// ============================================================
//   BUG DETECTION
// ============================================================
// Layer 1 — Zero-width / invisible characters commonly used to crash
const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD]/;

// Layer 2 — Arabic / Syriac / other RTL control characters
const RTL_CONTROL = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/;

// Layer 3 — Zalgo (excessive combining diacritics)
// If > 15 combining marks in a row → bug
function hasZalgo(text) {
    if (!text) return false;
    const combining = text.match(/[\u0300-\u036F\u0483-\u0489\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g);
    return combining && combining.length > 15;
}

// Layer 4 — Oversized messages (WhatsApp bug payloads are huge)
const MAX_MESSAGE_LENGTH = 5000;

// Layer 5 — Known crash sequences
const KNOWN_PATTERNS = [
    /[\u202E\u202D]{5,}/,          // Many RTL overrides
    /\u200B{10,}/,                 // Many zero-widths
    /\u061C{10,}/,                 // Many Arabic letter marks
    /[\u202A-\u202E]{3,}/          // RTL embed chains
];

function detectBug(text) {
    if (!text) return null;

    if (text.length > MAX_MESSAGE_LENGTH) {
        return { reason: 'oversized_message', detail: `${text.length} chars` };
    }
    if (hasZalgo(text)) {
        return { reason: 'zalgo', detail: 'excessive combining marks' };
    }
    if (ZERO_WIDTH.test(text)) {
        return { reason: 'zero_width', detail: 'invisible characters detected' };
    }
    if (RTL_CONTROL.test(text)) {
        return { reason: 'rtl_control', detail: 'RTL override detected' };
    }
    for (const pat of KNOWN_PATTERNS) {
        if (pat.test(text)) {
            return { reason: 'known_pattern', detail: 'matched known crash pattern' };
        }
    }
    return null;
}

// ============================================================
//   COMMAND
// ============================================================
module.exports = {
    name: 'antibug',
    category: 'auto',
    aliases: ['ab'],
    description: 'Toggle anti-bug (blocks malicious unicode / zalgo / oversize)',
    toggleKey: 'antibug',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;

        if (!isOwner) {
            return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        }

        if (isGroup) {
            if (!(await isBotGroupAdmin(conn, from))) {
                return conn.sendMessage(from, {
                    text: fancy('❌ I must be a group admin to use this in a group.')
                });
            }
        }

        const action = (args[0] || '').toLowerCase();

        if (action === '') {
            const on = await autoToggles.get(userId, 'antibug', null, config.antibug === true);
            return conn.sendMessage(from, {
                text: fancy(
                    `🐛 Anti-Bug (session-wide)\n\n` +
                    `Status: ${on ? '✅ ON' : '❌ OFF'}\n` +
                    `Blocks: zalgo, zero-width, RTL overrides, oversize`
                )
            }, { quoted: msg });
        }

        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}antibug on|off`) });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'antibug', null, value);

        return conn.sendMessage(from, {
            text: fancy(`✅ Anti-Bug ${value ? 'ENABLED' : 'DISABLED'} (all groups + DMs).`)
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const { from, sender, isGroup, isOwner, body, userId } = ctx;

        if (isOwner) return false;
        if (msg.key.fromMe) return false;
        if (!body || !body.trim()) return false;

        // group admins exempt in groups
        if (isGroup) {
            if (await isGroupAdmin(conn, from, sender)) return false;
        }

        const bug = detectBug(body);
        if (!bug) return false;

        // In groups, need admin to delete
        if (isGroup) {
            if (!(await isBotGroupAdmin(conn, from))) {
                console.log(`[antibug] bug detected but bot not admin in ${from}`);
                return false;
            }
        }

        // delete
        try {
            await conn.sendMessage(from, { delete: msg.key });
        } catch (e) {
            console.error('[antibug] delete failed:', e.message);
            return false;
        }

        // warn
        try {
            const senderBare = bareNum(sender);
            const warning =
                `🐛 *Anti-Bug*\n\n` +
                `⚠️ @${senderBare}, your message was removed.\n` +
                `Reason: ${bug.reason} (${bug.detail})`;

            await conn.sendMessage(from, {
                text: fancy(warning),
                mentions: [sender]
            });
        } catch (e) {
            console.error('[antibug] warn failed:', e.message);
        }

        return true;
    }
};