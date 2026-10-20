// commands/antistatusmention.js
// Deletes and warns when someone mentions a status in a group.
// Toggle: .antistatusmention on | off | (no args = show state)

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
    name: 'antistatusmention',
    category: 'auto',
    aliases: ['antistatus', 'asm'],
    description: 'Block status mentions in groups',
    toggleKey: 'antistatusmention',
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
            const on = await autoToggles.get(userId, 'antistatusmention', from, false);
            return conn.sendMessage(from, { 
                text: fancy(`📱 Anti-Status Mention: ${on ? '✅ ON' : '❌ OFF'}`) 
            }, { quoted: msg });
        }

        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}antistatusmention on|off`) });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'antistatusmention', from, value);
        
        return conn.sendMessage(from, { 
            text: fancy(`✅ Anti-Status Mention ${value ? 'ENABLED' : 'DISABLED'} for this group.`) 
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

        // 1. Detect WhatsApp's specific Status Mention message type
        const inner = msg.message || {};
        const type = Object.keys(inner)[0];
        
        // WhatsApp uses 'groupStatusMessageV2' for status mentions
        let isStatusMention = (type === 'groupStatusMessageV2' || type === 'groupStatusMessage');

        // 2. Fallback: Check for mentionedJid (just in case)
        if (!isStatusMention) {
            const ext = inner.extendedTextMessage || inner.imageMessage || inner.videoMessage;
            const mentioned = ext?.contextInfo?.mentionedJid || [];
            if (mentioned.includes('status@broadcast')) {
                isStatusMention = true;
            }
        }

        if (!isStatusMention) return false;

        // Exempt admins
        if (await isGroupAdmin(conn, from, sender)) return false;
        
        // Bot must be admin to delete
        if (!(await isBotGroupAdmin(conn, from))) return false;

        // Delete the message
        try {
            await conn.sendMessage(from, { delete: msg.key });
            console.log(`[antistatusmention] Deleted status mention from ${sender}`);
        } catch (e) {
            console.error('[antistatusmention] delete failed:', e.message);
            return false;
        }

        // Warn the user
        try {
            const senderBare = bareNum(sender);
            await conn.sendMessage(from, {
                text: fancy(`⚠️ @${senderBare}, mentioning statuses is not allowed in this group.`),
                mentions: [sender]
            });
        } catch (e) {
            console.error('[antistatusmention] warn failed:', e.message);
        }

        return true; // Stop processing
    }
};