const config = require('../../config');
const { fancy } = require('../../lib/font');
const messageStore = require('../../lib/messageStore');

module.exports = {
    name: 'antidelete',
    category: 'auto',
    tags: ['security'],
    description: 'Recover and repost deleted messages',
    enabled: (cfg) => cfg.antidelete !== false,
    async onMessage(conn, msg, ctx) {
        const type = Object.keys(msg.message || {})[0];
        const isRevoke = type === 'protocolMessage' && msg.message.protocolMessage?.type === 0;
        if (!isRevoke) return false;
        const dKey = msg.message.protocolMessage.key;
        const original = messageStore.get(dKey.id);
        if (!original) return false;
        const from = msg.key.remoteJid;
        const who = msg.key.participant || msg.key.remoteJid;
        try {
            await conn.sendMessage(from, {
                text: fancy(`🚨 ᴀɴᴛɪᴅᴇʟᴇᴛᴇ\n@${who.split('@')[0]} deleted a message:`),
                mentions: [who]
            });
            const om = original.msg;
            const text = om.message?.conversation || om.message?.extendedTextMessage?.text ||
                om.message?.imageMessage?.caption || om.message?.videoMessage?.caption;
            if (text && !original.mediaBuffer) {
                await conn.sendMessage(from, { text: `📄 ᴅᴇʟᴇᴛᴇᴅ:\n\n${text}` });
            } else if (original.mediaBuffer && original.mediaType === 'imageMessage') {
                await conn.sendMessage(from, { image: original.mediaBuffer, caption: text || '📷 ᴅᴇʟᴇᴛᴇᴅ ɪᴍᴀɢᴇ' });
            } else if (original.mediaBuffer && original.mediaType === 'videoMessage') {
                await conn.sendMessage(from, { video: original.mediaBuffer, caption: text || '🎥 ᴅᴇʟᴇᴛᴇᴅ ᴠɪᴅᴇᴏ' });
            } else if (original.mediaBuffer && original.mediaType === 'audioMessage') {
                await conn.sendMessage(from, { audio: original.mediaBuffer, mimetype: 'audio/mp4', ptt: true });
            } else if (original.mediaBuffer && original.mediaType === 'stickerMessage') {
                await conn.sendMessage(from, { sticker: original.mediaBuffer });
            }
            messageStore.remove(dKey.id);
            if (config.ownerNumber && who.split('@')[0] !== String(config.ownerNumber)) {
                try {
                    await conn.sendMessage(config.ownerNumber + '@s.whatsapp.net', {
                        text: `🚨 ᴀɴᴛɪᴅᴇʟᴇᴛᴇ ʟᴏɢ\nFrom: ${ctx.pushname}\nJID: ${who}\nChat: ${from}\nSession: ${ctx.userId}`
                    });
                } catch {}
            }
        } catch (e) { console.error('antidelete:', e.message); }
        return true;
    }
};
