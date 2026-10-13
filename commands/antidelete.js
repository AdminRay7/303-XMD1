// commands/antidelete.js
// Anti-delete with full media recovery (text, photo, video, audio, sticker, doc).
//
// Flow:
//   1. handler.js caches EVERY incoming message in lib/messageStore.js
//   2. When someone revokes a message, WhatsApp sends protocolMessage REVOKE
//   3. handler calls our onMessage() (only if toggle ON for this group)
//   4. We look up the original in messageStore and repost it
//
// Toggle: .antidelete on | off | (no args = show state)

const autoToggles = require('../lib/autoToggles');
const messageStore = require('../lib/messageStore');
const { fancy } = require('../lib/font');
const config = require('../config');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

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
    } catch (e) {
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
    } catch { return false; }
}

// ---------------- command ----------------
module.exports = {
    name: 'antidelete',
    category: 'auto',
    aliases: ['ad'],
    description: 'Toggle anti-delete (recovers deleted messages incl. media)',
    toggleKey: 'antidelete',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;

        if (!isOwner) {
            return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        }
        if (!isGroup) {
            return conn.sendMessage(from, { text: fancy('❌ Group only command.') });
        }
        if (!(await isBotGroupAdmin(conn, from))) {
            return conn.sendMessage(from, { text: fancy('❌ I must be a group admin to use this.') });
        }

        const action = (args[0] || '').toLowerCase();

        if (action === '') {
            const on = await autoToggles.get(userId, 'antidelete', from, config.antidelete === true);
            return conn.sendMessage(from, {
                text: fancy(`🗑️ Anti-Delete in this group: ${on ? '✅ ON' : '❌ OFF'}`)
            }, { quoted: msg });
        }

        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, {
                text: fancy(`Usage: ${config.prefix}antidelete on|off`)
            }, { quoted: msg });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'antidelete', from, value);
        return conn.sendMessage(from, {
            text: fancy(`✅ Anti-Delete ${value ? 'ENABLED' : 'DISABLED'} for this group.`)
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT — fires on every message when toggle ON
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const { from, isGroup, userId } = ctx;

        // group-only
        if (!isGroup) return false;

        // Is this a REVOKE?
        const protocol = msg.message?.protocolMessage;
        if (!protocol) return false;
        if (protocol.type !== 0) return false;         // 0 = REVOKE

        const targetId = protocol.key?.id;
        if (!targetId) return false;

        // Look up the original cached message
        const cached = messageStore.get(targetId);
        if (!cached) {
            console.log(`[antidelete] revoke detected but no cache for id=${targetId}`);
            return false;
        }

        const senderJid = protocol.key?.participant || protocol.participant || cached.sender;
        const senderBare = bareNum(senderJid);

        // Notify the group
        try {
            await conn.sendMessage(from, {
                text: fancy(`🗑️ *Anti-Delete*\n\n👤 @${senderBare} deleted a message. Recovering…`),
                mentions: [senderJid]
            });
        } catch (e) {
            console.error('[antidelete] pre-warn failed:', e.message);
        }

        // Recover the original
        try {
            const type = cached.type;
            const msgData = cached.message || {};

            // ---------- TEXT ----------
            const textBody =
                msgData.conversation ||
                msgData.extendedTextMessage?.text ||
                (msgData.imageMessage?.caption) ||
                (msgData.videoMessage?.caption) ||
                (msgData.documentMessage?.caption) || '';

            // ---------- MEDIA (buffer) ----------
            if (cached.mediaBuffer && cached.mediaKind) {
                const buf = cached.mediaBuffer;
                const mime = cached.mediaMime || 'application/octet-stream';
                const caption = textBody
                    ? `${fancy(`🗑️ *Anti-Delete*\n\n👤 @${senderBare}`)}\n\n${textBody}`
                    : fancy(`🗑️ *Anti-Delete*\n\n👤 @${senderBare} deleted this:`);

                let content;
                switch (cached.mediaKind) {
                    case 'image':
                        content = { image: buf, mimetype: mime, caption };
                        break;
                    case 'video':
                        content = { video: buf, mimetype: mime, caption };
                        break;
                    case 'audio':
                        content = { audio: buf, mimetype: mime, ptt: cached.ptt === true };
                        break;
                    case 'sticker':
                        content = { sticker: buf };
                        break;
                    case 'document':
                        content = { document: buf, mimetype: mime, fileName: cached.fileName || 'file', caption };
                        break;
                    default:
                        content = { text: caption };
                }
                await conn.sendMessage(from, content);
                return true;
            }

            // ---------- TEXT ONLY ----------
            if (textBody) {
                await conn.sendMessage(from, {
                    text: fancy(`🗑️ *Anti-Delete*\n\n👤 @${senderBare} deleted:\n\n${textBody}`),
                    mentions: [senderJid]
                });
                return true;
            }

            // ---------- NOTHING USEFUL ----------
            await conn.sendMessage(from, {
                text: fancy(`🗑️ @${senderBare} deleted a message but content is not recoverable.`),
                mentions: [senderJid]
            });
            return true;

        } catch (e) {
            console.error('[antidelete] recover failed:', e.message);
            return false;
        }
    }
};