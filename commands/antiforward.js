// commands/antiforward.js
// Deletes forwarded messages in groups.
// Toggle: .antiforward on | off | (no args = show state)

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
        return me && (me.admin === 'admin' || me.admin === 'superadmin');
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

module.exports = {
    name: 'antiforward',
    category: 'auto',
    aliases: ['af', 'noforward'],
    description: 'Delete forwarded messages in groups',
    toggleKey: 'antiforward',
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
            const on = await autoToggles.get(userId, 'antiforward', from, false);
            return conn.sendMessage(from, { 
                text: fancy(`🚫 Anti-Forward: ${on ? '✅ ON' : '❌ OFF'}`) 
            }, { quoted: msg });
        }

        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}antiforward on|off`) });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'antiforward', from, value);
        
        return conn.sendMessage(from, { 
            text: fancy(`✅ Anti-Forward ${value ? 'ENABLED' : 'DISABLED'} for this group.`) 
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const { from, sender, isGroup, isOwner } = ctx;

        if (!isGroup) return false;
        if (isOwner) return false;
        if (msg.key.fromMe) return false;

        // Check WhatsApp's native "Forwarded" flag
        // In Baileys, a forwarded message has `contextInfo.isForwarded = true`
        // or `contextInfo.forwardingScore > 0`
        const inner = msg.message || {};
        const type = Object.keys(inner)[0];
        const content = inner[type] || {};
        const contextInfo = content.contextInfo || {};

        const isForwarded = contextInfo.isForwarded === true || (contextInfo.forwardingScore && contextInfo.forwardingScore > 0);

        if (!isForwarded) return false;

        // Exempt admins
        if (await isGroupAdmin(conn, from, sender)) return false;
        
        // Bot must be admin to delete
        if (!(await isBotGroupAdmin(conn, from))) return false;

        // Delete the message
        try {
            await conn.sendMessage(from, { delete: msg.key });
            console.log(`[antiforward] Deleted forwarded message from ${sender}`);
        } catch (e) {
            console.error('[antiforward] delete failed:', e.message);
            return false;
        }

        // Warn the user
        try {
            const senderBare = bareNum(sender);
            await conn.sendMessage(from, {
                text: fancy(`⚠️ @${senderBare}, forwarded messages are not allowed here.`),
                mentions: [sender]
            });
        } catch (e) {
            console.error('[antiforward] warn failed:', e.message);
        }

        return true; // Stop processing
    }
};