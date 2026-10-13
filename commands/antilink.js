// commands/antilink.js
// Multi-user anti-link. Any of these can toggle or bypass:
//   - .env OWNER_NUMBER (bot super-owner)
//   - The session's own linked number (session owner)
//   - Any group admin in the current group
// Enforcement requires: bot is group admin.

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.(com|net|org|io|co|ke|me|xyz|info|app|dev|site|online)(\/[^\s]*)?)/i;

// ---------------- helpers ----------------
function bareNum(jid) {
    return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

async function isBotGroupAdmin(conn, groupJid) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        const botBare  = bareNum(conn.user?.id);
        const botLidBare = bareNum(conn.user?.lid);

        const me = meta.participants.find(p => {
            const pidBare = bareNum(p.id);
            return pidBare === botBare || (botLidBare && pidBare === botLidBare);
        });
        if (!me) return false;
        return me.admin === 'admin' || me.admin === 'superadmin';
    } catch (e) {
        console.error('[antilink] admin check error:', e.message);
        return false;
    }
}

async function isGroupAdmin(conn, groupJid, senderJid) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        const senderBare = bareNum(senderJid);
        return meta.participants.some(p =>
            bareNum(p.id) === senderBare &&
            (p.admin === 'admin' || p.admin === 'superadmin')
        );
    } catch (e) {
        return false;
    }
}

// Who can control antilink + who is exempt from deletion
async function canControl(conn, groupJid, ctx) {
    const { sender, isOwner } = ctx;
    if (isOwner) return true;                                  // super-owner or session owner
    if (msgFromBot(ctx.msg, conn)) return true;                // sent by bot itself
    return isGroupAdmin(conn, groupJid, sender);               // any group admin
}

function msgFromBot(msg, conn) {
    return msg?.key?.fromMe === true;
}

// ---------------- command ----------------
module.exports = {
    name: 'antilink',
    category: 'auto',
    aliases: ['al'],
    description: 'Toggle anti-link for this group (owner or group admin only)',
    toggleKey: 'antilink',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isGroup, userId } = ctx;

        // group only
        if (!isGroup) {
            return conn.sendMessage(from, { text: fancy('❌ Group only command.') });
        }

        // sender must be owner OR group admin
        const allowed = await canControl(conn, from, ctx);
        if (!allowed) {
            return conn.sendMessage(from, {
                text: fancy('❌ Only the session owner or a group admin can use this.')
            });
        }

        // bot must be group admin to enforce
        if (!(await isBotGroupAdmin(conn, from))) {
            return conn.sendMessage(from, { text: fancy('❌ I must be a group admin to use this.') });
        }

        const action = (args[0] || '').toLowerCase();

        // show state
        if (!action) {
            const current = await autoToggles.get(userId, 'antilink', from, config.antilink === true);
            return conn.sendMessage(from, {
                text: fancy(`🔗 Anti-Link in this group: ${current ? '✅ ON' : '❌ OFF'}`)
            }, { quoted: msg });
        }

        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, {
                text: fancy(`Usage: ${config.prefix}antilink on|off`)
            }, { quoted: msg });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'antilink', from, value);

        return conn.sendMessage(from, {
            text: fancy(`✅ Anti-Link ${value ? 'ENABLED' : 'DISABLED'} for this group.`)
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT — runs on every group message when toggle is ON
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const { from, sender, isGroup, isOwner, body } = ctx;

        if (!isGroup) return false;
        if (isOwner) return false;                    // super-owner / session owner exempt
        if (msgFromBot(msg, conn)) return false;      // bot's own messages exempt
        if (!body || !body.trim()) return false;

        // group admins exempt
        if (await isGroupAdmin(conn, from, sender)) return false;

        // link?
        if (!URL_REGEX.test(body)) return false;

        // bot must be admin to delete
        if (!(await isBotGroupAdmin(conn, from))) return false;

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