// commands/antilink.js
// Anti-link — GROUP ONLY.
// Toggle: .antilink on | off | (no args = show state)
// .antilink on enables link-blocking for ALL groups in this session.
// DM messages are ignored entirely.

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|(?:chat\.whatsapp\.com|wa\.me|t\.me)\/[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?)/i;

// ---------------- helpers ----------------
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

// ---------------- command ----------------
module.exports = {
    name: 'antilink',
    category: 'auto',
    aliases: ['al'],
    description: 'Toggle anti-link for all groups in this session',
    toggleKey: 'antilink',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;

        if (!isOwner) {
            return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        }

        // If run inside a group, bot must be group admin there
        if (isGroup) {
            if (!(await isBotGroupAdmin(conn, from))) {
                return conn.sendMessage(from, {
                    text: fancy('❌ I must be a group admin to use this in a group.')
                });
            }
        }

        const action = (args[0] || '').toLowerCase();

        // ---- show state ----
        if (action === '') {
            const on = await autoToggles.get(userId, 'antilink', null, config.antilink === true);
            return conn.sendMessage(from, {
                text: fancy(
                    `🔗 Anti-Link (session-wide, groups only)\n\n` +
                    `Status: ${on ? '✅ ON' : '❌ OFF'}\n` +
                    `Applies to: all groups in this session`
                )
            }, { quoted: msg });
        }

        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, {
                text: fancy(`Usage: ${config.prefix}antilink on|off`)
            }, { quoted: msg });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'antilink', null, value);

        return conn.sendMessage(from, {
            text: fancy(`✅ Anti-Link ${value ? 'ENABLED' : 'DISABLED'} for all groups in this session.`)
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT — GROUP ONLY
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const { from, sender, isGroup, isOwner, body } = ctx;

        // HARD group-only check
        if (!isGroup) return false;

        // owner exempt
        if (isOwner) return false;

        // fromMe exempt
        if (msg.key.fromMe) return false;

        // empty body
        if (!body || !body.trim()) return false;

        // group admins exempt (so admins can still share links)
        if (await isGroupAdmin(conn, from, sender)) return false;

        // link?
        if (!URL_REGEX.test(body)) return false;

        // bot must be group admin in THIS group to delete
        if (!(await isBotGroupAdmin(conn, from))) {
            console.log('[antilink] link detected but bot is not admin in', from);
            return false;
        }

        // delete
        try {
            await conn.sendMessage(from, { delete: msg.key });
        } catch (e) {
            console.error('[antilink] delete failed:', e.message);
            return false;
        }

        // warn
        try {
            const senderBare = bareNum(sender);
            await conn.sendMessage(from, {
                text: fancy(`⚠️ @${senderBare}, links are not allowed in this group.`),
                mentions: [sender]
            });
        } catch (e) {
            console.error('[antilink] warn failed:', e.message);
        }

        return true;
    }
};