// commands/antilink.js
// Anti-link toggle + enforcement in one file.
// Toggle: .antilink on | off | (no args = show state)
// Enforce: auto-deletes links in this group when ON.
//
// Rules:
//   - Toggle is OWNER-ONLY
//   - Toggle requires: group chat + bot is group admin
//   - Enforcement requires: group chat + bot is group admin
//   - State is per-group (falls back to session if not set for group)

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.(com|net|org|io|co|ke|me|xyz|info|app|dev|site|online)(\/[^\s]*)?)/i;

// ---------------- helpers ----------------
async function botIsGroupAdmin(conn, groupJid) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        const botId = conn.user?.id || '';
        const botLid = botId.split(':')[0] + '@s.whatsapp.net';
        const me = meta.participants.find(p =>
            p.id === botId || p.id === botLid || p.id?.split(':')[0] === botId.split(':')[0]
        );
        return !!(me && (me.admin === 'admin' || me.admin === 'superadmin'));
    } catch (e) {
        return false;
    }
}

// ---------------- command ----------------
module.exports = {
    name: 'antilink',
    category: 'auto',
    aliases: ['al'],
    description: 'Toggle anti-link for this group (owner + bot admin only)',
    toggleKey: 'antilink',   // enables the enforcement hook below
    enabled: () => true,     // always available; runtime toggle controls enforcement

    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;

        // --- guard: owner only ---
        if (!isOwner) {
            return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        }

        // --- guard: group only ---
        if (!isGroup) {
            return conn.sendMessage(from, { text: fancy('❌ Group only command.') });
        }

        // --- guard: bot must be group admin ---
        if (!(await botIsGroupAdmin(conn, from))) {
            return conn.sendMessage(from, { text: fancy('❌ I must be a group admin to use this.') });
        }

        const action = (args[0] || '').toLowerCase();

        // --- show state ---
        if (!action) {
            const current = await autoToggles.get(userId, 'antilink', from, config.antilink === true);
            return conn.sendMessage(from, {
                text: fancy(`🔗 Anti-Link in this group: ${current ? '✅ ON' : '❌ OFF'}`)
            }, { quoted: msg });
        }

        // --- invalid ---
        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, {
                text: fancy(`Usage: ${config.prefix}antilink on|off`)
            }, { quoted: msg });
        }

        // --- set ---
        const value = action === 'on';
        await autoToggles.set(userId, 'antilink', from, value);

        return conn.sendMessage(from, {
            text: fancy(`✅ Anti-Link ${value ? 'ENABLED' : 'DISABLED'} for this group.`)
        }, { quoted: msg });
    },

    // ============================================================
    //   AUTO ENFORCEMENT HOOK
    //   Fires on every message. Handler checks the runtime toggle
    //   (mod.toggleKey = 'antilink') before calling this.
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const { from, sender, isGroup, isOwner, userId, body } = ctx;

        // group only
        if (!isGroup) return false;
        // owner exempt
        if (isOwner) return false;
        // empty body
        if (!body || !body.trim()) return false;

        // group admins exempt (optional — remove if you want to nuke admins too)
        try {
            const meta = await conn.groupMetadata(from);
            const adminIds = meta.participants
                .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                .map(p => p.id);
            const senderBare = sender.split(':')[0];
            if (adminIds.some(id => id === sender || id.split(':')[0] === senderBare)) return false;
        } catch (e) {
            // if we can't read the group, don't act
            return false;
        }

        // detect link
        if (!URL_REGEX.test(body)) return false;

        // bot must be admin to delete
        if (!(await botIsGroupAdmin(conn, from))) return false;

        // delete the message
        try {
            await conn.sendMessage(from, { delete: msg.key });
        } catch (e) {
            console.error('[antilink] delete failed:', e.message);
            return false;
        }

        // warn the sender
        try {
            await conn.sendMessage(from, {
                text: fancy(`⚠️ @${sender.split('@')[0]}, links are not allowed in this group.`),
                mentions: [sender]
            });
        } catch (e) {
            console.error('[antilink] warn failed:', e.message);
        }

        // consume — stop further processing
        return true;
    }
};